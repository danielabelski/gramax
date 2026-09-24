#[cfg(target_os = "macos")]
fn main() {
	macos::main();
}

#[cfg(not(target_os = "macos"))]
fn main() {}

#[cfg(target_os = "macos")]
mod macos {
	use std::path::{Path, PathBuf};
	use std::sync::{Arc, Mutex};
	use std::time::{Duration, Instant};

	use gramax::macos_print_test_support::{run_print_operation, PrintOutcome};
	use objc2::rc::Retained;
	use objc2::{AnyThread, MainThreadMarker, MainThreadOnly};
	use objc2_app_kit::{
		NSApplication, NSApplicationActivationPolicy, NSBackingStoreType, NSEventMask, NSModalResponseCancel, NSPrintInfo, NSPrintJobSavingURL,
		NSPrintOperation, NSPrintSaveJob, NSWindow, NSWindowStyleMask,
	};
	use objc2_foundation::{NSCopying, NSDate, NSDefaultRunLoopMode, NSPoint, NSRect, NSSize, NSString, NSURL};
	use objc2_pdf_kit::PDFDocument;
	use objc2_web_kit::{WKWebView, WKWebViewConfiguration};

	// The copy the paginator lays out is hidden on screen and shown to print media only
	// (core/extensions/print/components/PrintView.tsx).
	const PAGE: &str = r#"<style>
		.print-view { visibility: hidden }
		@media print { .print-view { visibility: visible } .app { display: none } }
	</style>
	<div class="app">Application screen</div>
	<div class="print-view"><h1>Printed article</h1><p>First paragraph of the article.</p></div>"#;

	// runOperation() on the main thread never returns from a panel-less job: it keeps writing pages.
	const DEADLINE: Duration = Duration::from_secs(60);

	pub fn main() {
		let output = tempfile::tempdir().expect("temp dir");
		spawn_watchdog(output.path().to_path_buf());

		let mtm = MainThreadMarker::new().expect("runs on the main thread");
		let app = NSApplication::sharedApplication(mtm);
		app.setActivationPolicy(NSApplicationActivationPolicy::Accessory);
		app.finishLaunching();
		let page = Page::load(mtm, PAGE);

		let pdf = output.path().join("article.pdf");
		let (outcome, text) = page.save_as_pdf(&pdf);
		let cancelled = page.cancel_print_panel();

		let results = [
			check(
				"a saved PDF is reported as printed",
				outcome == PrintOutcome::Printed,
				&format!("{outcome:?}"),
			),
			check(
				"the PDF holds the print view, not a blank sheet, by the time the operation reports done",
				text.contains("Printed article") && !text.contains("Application screen"),
				&format!("PDF text: {text:?}"),
			),
			check(
				"cancelling the print panel is reported as cancelled, not as a failure",
				cancelled == PrintOutcome::Cancelled,
				&format!("{cancelled:?}"),
			),
		];

		if results.contains(&false) {
			std::process::exit(1);
		}
	}

	struct Page {
		mtm: MainThreadMarker,
		window: Retained<NSWindow>,
		webview: Retained<WKWebView>,
	}

	impl Page {
		fn load(mtm: MainThreadMarker, html: &str) -> Self {
			let frame = NSRect::new(NSPoint::new(0.0, 0.0), NSSize::new(900.0, 700.0));
			let window = unsafe {
				NSWindow::initWithContentRect_styleMask_backing_defer(
					NSWindow::alloc(mtm),
					frame,
					NSWindowStyleMask::Titled,
					NSBackingStoreType::Buffered,
					false,
				)
			};
			unsafe { window.setReleasedWhenClosed(false) };

			let configuration = unsafe { WKWebViewConfiguration::new(mtm) };
			let webview = unsafe { WKWebView::initWithFrame_configuration(WKWebView::alloc(mtm), frame, &configuration) };
			window.contentView().expect("content view").addSubview(&webview);
			window.orderFront(None);

			unsafe { webview.loadHTMLString_baseURL(&NSString::from_str(html), None) };
			pump_until(mtm, || unsafe { webview.estimatedProgress() >= 1.0 && !webview.isLoading() });

			Self { mtm, window, webview }
		}

		/// What the reader gets from the panel's "Save as PDF", without the panel: the job writes `pdf`.
		fn save_as_pdf(&self, pdf: &Path) -> (PrintOutcome, String) {
			let info = NSPrintInfo::sharedPrintInfo().copy();
			unsafe {
				info.setJobDisposition(NSPrintSaveJob);
				info
					.dictionary()
					.insert(NSPrintJobSavingURL, &NSURL::fileURLWithPath(&NSString::from_str(&pdf.to_string_lossy())));
			}
			let operation = self.operation(&info, false);

			let pdf = pdf.to_path_buf();
			self.run(&operation, || {}, move |outcome| (outcome, pdf_text(&pdf)))
		}

		fn cancel_print_panel(&self) -> PrintOutcome {
			let operation = self.operation(&NSPrintInfo::sharedPrintInfo().copy(), true);
			self.run(&operation, || self.press_cancel_in_print_panel(), |outcome| outcome)
		}

		fn press_cancel_in_print_panel(&self) {
			pump_until(self.mtm, || self.window.attachedSheet().is_some());
			let panel = self.window.attachedSheet().expect("print panel");
			self.window.endSheet_returnCode(&panel, NSModalResponseCancel);
		}

		fn operation(&self, info: &NSPrintInfo, shows_panel: bool) -> Retained<NSPrintOperation> {
			let operation = unsafe { self.webview.printOperationWithPrintInfo(info) };
			operation.setShowsPrintPanel(shows_panel);
			operation.setShowsProgressPanel(false);
			operation
		}

		fn run<T: Send + 'static>(
			&self,
			operation: &NSPrintOperation,
			while_running: impl FnOnce(),
			on_done: impl FnOnce(PrintOutcome) -> T + Send + 'static,
		) -> T {
			let done = Arc::new(Mutex::new(None));
			let reported = done.clone();
			run_print_operation(operation, &self.window, move |outcome| {
				*reported.lock().unwrap() = Some(on_done(outcome));
			});
			while_running();
			pump_until(self.mtm, || done.lock().unwrap().is_some());
			let result = done.lock().unwrap().take().unwrap();
			result
		}
	}

	fn pdf_text(pdf: &Path) -> String {
		let url = NSURL::fileURLWithPath(&NSString::from_str(&pdf.to_string_lossy()));
		unsafe { PDFDocument::initWithURL(PDFDocument::alloc(), &url) }
			.and_then(|document| unsafe { document.string() })
			.map(|text| text.to_string())
			.unwrap_or_default()
	}

	fn pump_until(mtm: MainThreadMarker, mut ready: impl FnMut() -> bool) {
		let app = NSApplication::sharedApplication(mtm);
		while !ready() {
			let until = NSDate::dateWithTimeIntervalSinceNow(0.05);
			let event = unsafe { app.nextEventMatchingMask_untilDate_inMode_dequeue(NSEventMask::Any, Some(&until), NSDefaultRunLoopMode, true) };
			if let Some(event) = event {
				app.sendEvent(&event);
			}
		}
	}

	fn spawn_watchdog(output: PathBuf) {
		let started = Instant::now();
		std::thread::spawn(move || {
			std::thread::sleep(DEADLINE);
			eprintln!("print operation did not finish in {:?}", started.elapsed());
			let _ = std::fs::remove_dir_all(output);
			std::process::exit(1);
		});
	}

	fn check(name: &str, passed: bool, details: &str) -> bool {
		match passed {
			true => println!("test {name} ... ok"),
			false => println!("test {name} ... FAILED\n    {details}"),
		}
		passed
	}
}
