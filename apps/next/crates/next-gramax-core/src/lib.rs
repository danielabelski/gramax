#![cfg(not(target_family = "wasm"))]

use napi::Error;
use serde::Serialize;

#[macro_use]
extern crate napi_derive;

pub mod fs;
pub mod git;

pub type Output = std::result::Result<String, Error>;
pub type AsyncOutput = napi::bindgen_prelude::Result<String>;

pub trait JsonExt {
	fn json(&self) -> Output;
}

impl<T: Serialize, E: Serialize> JsonExt for Result<T, E> {
	fn json(&self) -> Output {
		match self {
			Ok(ok) => serde_json::to_string(ok).map_err(|e| Error::from_reason(e.to_string())),
			Err(err) => Err(
				serde_json::to_string(err)
					.map(Error::from_reason)
					.unwrap_or_else(|e| Error::from_reason(e.to_string())),
			),
		}
	}
}

#[derive(Debug)]
struct StderrJsonExporter;

impl opentelemetry_sdk::trace::SpanExporter for StderrJsonExporter {
	async fn export(&self, batch: Vec<opentelemetry_sdk::trace::SpanData>) -> opentelemetry_sdk::error::OTelSdkResult {
		for span in &batch {
			let otel = gramax_opentelemetry::OtelSpan::from(span);
			if let Ok(json) = serde_json::to_string(&otel) {
				eprintln!("{json}");
			}
		}
		Ok(())
	}
}

pub fn setup_remote_context(span_id: Option<&str>, trace_id: Option<&str>) -> opentelemetry::ContextGuard {
	use opentelemetry::trace::*;

	let span_id = span_id.and_then(|s| SpanId::from_hex(s).ok());
	let trace_id = trace_id.and_then(|s| TraceId::from_hex(s).ok());

	let (Some(span_id), Some(trace_id)) = (span_id, trace_id) else {
		return opentelemetry::Context::current().with_telemetry_suppressed().attach();
	};

	let context = SpanContext::new(trace_id, span_id, TraceFlags::SAMPLED, true, TraceState::default());
	opentelemetry::Context::current().with_remote_span_context(context).attach()
}

static FILTER_RELOAD_HANDLE: std::sync::OnceLock<
	tracing_subscriber::reload::Handle<tracing_subscriber::EnvFilter, tracing_subscriber::Registry>,
> = std::sync::OnceLock::new();

/// Runtime otel level switch from JS — same Gramax scale as the Tauri `set_otel_level` command.
/// Crate-scoped `RUST_LOG` directives (`crate=level`) are preserved; only the global level is replaced.
#[napi(js_name = "set_otel_level")]
pub fn set_otel_level(level: String) -> napi::Result<()> {
	let directive = match level.as_str() {
		"off" => "off",
		"commands" => "error",
		"important" => "warn",
		"internal" => "info",
		"files" => "debug",
		"full" => "trace",
		_ => return Err(Error::from_reason(format!("unknown otel level: {level}"))),
	};

	let handle = FILTER_RELOAD_HANDLE
		.get()
		.ok_or_else(|| Error::from_reason("tracing is not initialized"))?;

	let scoped = std::env::var("RUST_LOG")
		.unwrap_or_default()
		.split(',')
		.filter(|d| d.contains('='))
		.collect::<Vec<_>>()
		.join(",");
	let directives = if scoped.is_empty() { directive.to_string() } else { format!("{directive},{scoped}") };

	let filter = tracing_subscriber::EnvFilter::builder()
		.parse(directives)
		.map_err(|err| Error::from_reason(err.to_string()))?;
	handle.reload(filter).map_err(|err| Error::from_reason(err.to_string()))
}

#[ctor::ctor(unsafe)]
fn init() {
	use tracing_subscriber::layer::SubscriberExt;
	use tracing_subscriber::util::SubscriberInitExt;

	let env_filter = tracing_subscriber::EnvFilter::try_from_default_env().unwrap_or(tracing_subscriber::EnvFilter::new("info"));
	let (env_filter, reload_handle) = tracing_subscriber::reload::Layer::new(env_filter);
	let _ = FILTER_RELOAD_HANDLE.set(reload_handle);

	let provider = opentelemetry_sdk::trace::SdkTracerProvider::builder()
		.with_sampler(opentelemetry_sdk::trace::Sampler::ParentBased(Box::new(
			opentelemetry_sdk::trace::Sampler::AlwaysOff,
		)))
		.with_simple_exporter(StderrJsonExporter)
		.build();
	opentelemetry::global::set_tracer_provider(provider);

	tracing_subscriber::registry()
		.with(env_filter)
		.with(
			tracing_opentelemetry::layer()
				.with_location(false)
				.with_threads(false)
				.with_tracked_inactivity(false)
				.with_tracer(opentelemetry::global::tracer("app")),
		)
		.init();
}
