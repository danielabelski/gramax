use std::cell::OnceCell;
use std::ffi::c_void;

use objc2::rc::Retained;
use objc2::runtime::{Bool, NSObject};
use objc2::{define_class, msg_send, sel, AnyThread};
use objc2_app_kit::{NSPrintCancelJob, NSPrintOperation, NSWindow};

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum PrintOutcome {
	Printed,
	Cancelled,
	Failed,
}

type Done = Box<dyn FnOnce(PrintOutcome) + Send>;

/// Runs `operation` the way Wry prints — the panel as a sheet on `window`, pages rendered on a separate thread —
/// and calls `done` once the operation is over: the pages are already with the printer or in the PDF file.
///
/// Not `runOperation()`: WKWebView cannot render print pages on the main thread, so the panel previews the
/// document and the job itself comes out blank (gram-ax/gramax#981).
pub fn run_print_operation(operation: &NSPrintOperation, window: &NSWindow, done: impl FnOnce(PrintOutcome) + Send + 'static) {
	let done: Box<Done> = Box::new(Box::new(done));
	operation.setCanSpawnSeparateThread(true);
	let delegate = delegate();

	unsafe {
		operation.runOperationModalForWindow_delegate_didRunSelector_contextInfo(
			window,
			Some(&delegate),
			Some(sel!(printOperationDidRun:success:contextInfo:)),
			Box::into_raw(done).cast(),
		);
	}
}

define_class!(
	#[unsafe(super(NSObject))]
	#[name = "GramaxPrintOperationDelegate"]
	struct PrintOperationDelegate;

	impl PrintOperationDelegate {
		// Sent on the printing thread once the job is done, on the main thread when the panel was cancelled.
		#[unsafe(method(printOperationDidRun:success:contextInfo:))]
		fn did_run(&self, operation: &NSPrintOperation, success: Bool, context: *mut c_void) {
			let done = unsafe { Box::from_raw(context.cast::<Done>()) };
			let cancelled = operation.printInfo().jobDisposition().isEqualToString(unsafe { NSPrintCancelJob });
			done(match (success.as_bool(), cancelled) {
				(true, _) => PrintOutcome::Printed,
				(false, true) => PrintOutcome::Cancelled,
				(false, false) => PrintOutcome::Failed,
			});
		}
	}
);

fn delegate() -> Retained<PrintOperationDelegate> {
	// The print operation does not retain its delegate, so one outlives every operation.
	thread_local! {
		static DELEGATE: OnceCell<Retained<PrintOperationDelegate>> = const { OnceCell::new() };
	}

	DELEGATE.with(|delegate| {
		delegate
			.get_or_init(|| unsafe { msg_send![PrintOperationDelegate::alloc(), init] })
			.clone()
	})
}
