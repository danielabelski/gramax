use std::io::{BufRead, BufReader, Read, Write};
use std::net::{TcpStream, ToSocketAddrs};
use std::time::Duration;

use base64::engine::general_purpose::STANDARD;
use base64::Engine;
use serde::Deserialize;
use serde::Serialize;
use tauri::Runtime;
use url::Url;

const CONNECT_TIMEOUT: Duration = Duration::from_secs(10);
const IO_TIMEOUT: Duration = Duration::from_secs(30);
const MAX_BODY_CHARS: usize = 256 * 1024;

#[derive(Deserialize)]
struct Auth {
	username: String,
	password: String,
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
struct Request {
	url: String,
	command: Option<String>,
	body: Option<String>,
	auth: Option<Auth>,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
struct Response {
	status: String,
	status_text: String,
	ok: bool,
	body: String,
	truncated: bool,
}

#[derive(Serialize)]
struct RequestError {
	message: String,
}

impl From<std::io::Error> for RequestError {
	fn from(error: std::io::Error) -> Self {
		RequestError { message: error.to_string() }
	}
}

impl From<native_tls::Error> for RequestError {
	fn from(error: native_tls::Error) -> Self {
		RequestError { message: error.to_string() }
	}
}

impl From<url::ParseError> for RequestError {
	fn from(error: url::ParseError) -> Self {
		RequestError { message: error.to_string() }
	}
}

struct Session {
	reader: BufReader<native_tls::TlsStream<TcpStream>>,
}

fn send(req: Request) -> std::result::Result<Response, RequestError> {
	let url = Url::parse(&req.url)?;
	let host = url.host_str().ok_or_else(|| RequestError {
		message: "url host is required".into(),
	})?;
	let (is_imap, default_port) = match url.scheme() {
		"imaps" => (true, 993),
		"smtps" => (false, 465),
		other => {
			return Err(RequestError {
				message: format!("only imaps:// and smtps:// are supported, got: {other}"),
			})
		}
	};
	let port = url.port().unwrap_or(default_port);
	let mailbox = url
		.path_segments()
		.map(|s| {
			s.filter(|p| !p.is_empty())
				.map(|p| percent_encoding::percent_decode_str(p).decode_utf8_lossy())
				.collect::<Vec<_>>()
				.join("/")
		})
		.filter(|s| !s.is_empty());

	let mut session = connect(host, port)?;
	if is_imap {
		imap(&mut session, mailbox, req)
	} else {
		smtp(&mut session, req)
	}
}

fn connect(host: &str, port: u16) -> std::result::Result<Session, RequestError> {
	let mut last_error = None;
	for addr in (host, port).to_socket_addrs()? {
		match TcpStream::connect_timeout(&addr, CONNECT_TIMEOUT) {
			Ok(stream) => {
				stream.set_read_timeout(Some(IO_TIMEOUT))?;
				stream.set_write_timeout(Some(IO_TIMEOUT))?;
				let tls = native_tls::TlsConnector::new()?
					.connect(host, stream)
					.map_err(|e| RequestError { message: e.to_string() })?;
				return Ok(Session { reader: BufReader::new(tls) });
			}
			Err(e) => last_error = Some(e),
		}
	}
	match last_error {
		None => Err(RequestError {
			message: format!("cannot resolve {host}:{port}"),
		}),
		Some(e) => Err(e.into()),
	}
}

fn imap(session: &mut Session, mailbox: Option<String>, req: Request) -> std::result::Result<Response, RequestError> {
	let mut body = vec![session.read_line()?];
	let mut n = 1;

	if let Some(auth) = &req.auth {
		let (status, text, truncated) = tagged(
			session,
			&mut n,
			&format!("LOGIN {} {}", quote(&auth.username), quote(&auth.password)),
			&mut body,
		)?;
		if truncated || status != "OK" {
			return Ok(response(&status, &text, &body, false, truncated));
		}
	}

	if let Some(mailbox) = &mailbox {
		let (status, text, truncated) = tagged(session, &mut n, &format!("SELECT {}", quote(mailbox)), &mut body)?;
		if truncated || status != "OK" {
			return Ok(response(&status, &text, &body, false, truncated));
		}
	}

	if let Some(cmd) = req.command.as_deref().map(str::trim).filter(|c| !c.is_empty()) {
		let (status, text, truncated) = tagged(session, &mut n, cmd, &mut body)?;
		if !truncated {
			let _ = session.write_line(&format!("A{n} LOGOUT"));
		}
		return Ok(response(&status, &text, &body, status == "OK" && !truncated, truncated));
	}

	let _ = session.write_line(&format!("A{n} LOGOUT"));
	Ok(response("OK", "", &body, true, false))
}

fn tagged(
	session: &mut Session,
	n: &mut u32,
	cmd: &str,
	body: &mut Vec<String>,
) -> std::result::Result<(String, String, bool), RequestError> {
	let tag = format!("A{n}");
	*n += 1;
	session.write_line(&format!("{tag} {cmd}"))?;
	let mut used: usize = body.iter().map(|s| s.chars().count()).sum();
	loop {
		let remaining = MAX_BODY_CHARS.saturating_sub(used);
		let (line, truncated) = session.read_imap_line(remaining)?;
		if let Some(rest) = line.strip_prefix(&format!("{tag} ")) {
			let (status, text) = rest.split_once(' ').unwrap_or((rest, ""));
			return Ok((status.to_string(), text.to_string(), truncated));
		}
		used = used.saturating_add(line.chars().count());
		body.push(line);
		if truncated || used > MAX_BODY_CHARS {
			return Ok((String::new(), String::new(), true));
		}
	}
}

fn smtp(session: &mut Session, req: Request) -> std::result::Result<Response, RequestError> {
	let raw = req.body.ok_or_else(|| RequestError {
		message: "body is required for SMTP".into(),
	})?;
	let (mail_from, recipients, data) = parse_rfc822(&raw)?;
	let mut out = Vec::new();

	if smtp_read(session, &mut out)? / 100 != 2 {
		return Ok(smtp_response(&out));
	}
	if smtp_cmd(session, "EHLO gramax", &mut out)? / 100 != 2 {
		return Ok(smtp_response(&out));
	}

	if let Some(auth) = &req.auth {
		let code = smtp_cmd(session, "AUTH LOGIN", &mut out)?;
		if code == 334 {
			let code = smtp_cmd(session, &STANDARD.encode(&auth.username), &mut out)?;
			if code == 334 {
				let code = smtp_cmd(session, &STANDARD.encode(&auth.password), &mut out)?;
				if code / 100 != 2 {
					return Ok(smtp_response(&out));
				}
			} else if code / 100 != 2 {
				return Ok(smtp_response(&out));
			}
		} else if code / 100 != 2 {
			return Ok(smtp_response(&out));
		}
	}

	if smtp_cmd(session, &format!("MAIL FROM:<{mail_from}>"), &mut out)? / 100 != 2 {
		return Ok(smtp_response(&out));
	}
	for rcpt in &recipients {
		if smtp_cmd(session, &format!("RCPT TO:<{rcpt}>"), &mut out)? / 100 != 2 {
			return Ok(smtp_response(&out));
		}
	}

	if smtp_cmd(session, "DATA", &mut out)? != 354 {
		return Ok(smtp_response(&out));
	}
	session.write_all(dot_stuff(&data).as_bytes())?;
	session.write_all(b".\r\n")?;
	let code = smtp_read(session, &mut out)?;
	let status_text = out
		.last()
		.and_then(|s| s.lines().last())
		.and_then(|s| s.get(4..))
		.unwrap_or("")
		.to_string();
	let _ = smtp_cmd(session, "QUIT", &mut out);
	Ok(response(&code.to_string(), &status_text, &out, code / 100 == 2, false))
}

fn smtp_cmd(session: &mut Session, cmd: &str, out: &mut Vec<String>) -> std::result::Result<u16, RequestError> {
	session.write_line(cmd)?;
	smtp_read(session, out)
}

fn smtp_read(session: &mut Session, out: &mut Vec<String>) -> std::result::Result<u16, RequestError> {
	let mut lines = Vec::new();
	loop {
		let line = session.read_line()?;
		let Some(code) = line.get(..3).and_then(|s| s.parse::<u16>().ok()) else {
			return Err(RequestError {
				message: format!("invalid SMTP reply: {line}"),
			});
		};
		let cont = line.as_bytes().get(3) == Some(&b'-');
		lines.push(line);
		if !cont {
			out.push(lines.join("\n"));
			return Ok(code);
		}
	}
}

impl Session {
	fn write_all(&mut self, data: &[u8]) -> std::result::Result<(), RequestError> {
		self.reader.get_mut().write_all(data)?;
		self.reader.get_mut().flush()?;
		Ok(())
	}

	fn write_line(&mut self, line: &str) -> std::result::Result<(), RequestError> {
		self.write_all(format!("{line}\r\n").as_bytes())
	}

	fn read_line(&mut self) -> std::result::Result<String, RequestError> {
		let mut line = String::new();
		if self.reader.read_line(&mut line)? == 0 {
			return Err(RequestError {
				message: "connection closed".into(),
			});
		}
		Ok(line.trim_end_matches(['\r', '\n']).to_string())
	}

	fn read_imap_line(&mut self, remaining: usize) -> std::result::Result<(String, bool), RequestError> {
		let mut line = String::new();
		let mut rest = self.read_line()?;
		loop {
			let Some(start) = rest.rfind('{') else { break };
			if !rest.ends_with('}') {
				break;
			}
			let inner = rest[start + 1..rest.len() - 1]
				.strip_suffix('+')
				.unwrap_or(&rest[start + 1..rest.len() - 1]);
			let Ok(size) = inner.parse::<usize>() else { break };
			let used = line.chars().count().saturating_add(rest.chars().count());
			if used >= remaining || size > remaining - used {
				line.push_str(&rest);
				return Ok((line, true));
			}
			line.push_str(&rest);
			let mut buf = vec![0u8; size];
			self.reader.read_exact(&mut buf)?;
			line.push('\n');
			line.push_str(&String::from_utf8_lossy(&buf));
			rest = self.read_line()?;
		}
		if !rest.is_empty() {
			line.push_str(&rest);
		}
		Ok((line, false))
	}
}

fn quote(value: &str) -> String {
	format!("\"{}\"", value.replace('\\', "\\\\").replace('"', "\\\""))
}

fn response(status: &str, status_text: &str, lines: &[String], ok: bool, truncated: bool) -> Response {
	let body = lines.join("\n");
	let truncated = truncated || body.chars().count() > MAX_BODY_CHARS;
	Response {
		status: status.to_string(),
		status_text: status_text.to_string(),
		ok,
		body: if truncated { body.chars().take(MAX_BODY_CHARS).collect() } else { body },
		truncated,
	}
}

fn smtp_response(out: &[String]) -> Response {
	let last = out.last().cloned().unwrap_or_default();
	let code: u16 = last.get(..3).and_then(|s| s.parse().ok()).unwrap_or(0);
	response(&code.to_string(), last.get(4..).unwrap_or(""), out, code / 100 == 2, false)
}

fn parse_rfc822(raw: &str) -> std::result::Result<(String, Vec<String>, String), RequestError> {
	let normalized = raw.replace("\r\n", "\n").replace('\r', "\n").replace('\n', "\r\n");
	let (headers, rest) = normalized.split_once("\r\n\r\n").ok_or_else(|| RequestError {
		message: "SMTP body must include a header/body separator".into(),
	})?;
	let mut from = None;
	let mut recipients = Vec::new();
	let mut keep = Vec::new();
	let mut field: Option<String> = None;
	let mut folded = String::new();
	let mut drop_field = false;
	let apply_field = |key: &str, folded: &str, from: &mut Option<String>, recipients: &mut Vec<String>| {
		if key == "from" {
			*from = emails(folded).into_iter().next();
		}
		if matches!(key, "to" | "cc" | "bcc") {
			recipients.extend(emails(folded));
		}
	};
	for line in headers.split("\r\n") {
		if line.starts_with(' ') || line.starts_with('\t') {
			if !drop_field {
				keep.push(line);
			}
			folded.push_str(line);
			continue;
		}
		if let Some(key) = field.take() {
			apply_field(&key, &folded, &mut from, &mut recipients);
		}
		folded.clear();
		let Some((name, value)) = line.split_once(':') else {
			drop_field = false;
			keep.push(line);
			continue;
		};
		let key = name.trim().to_ascii_lowercase();
		drop_field = key == "bcc";
		field = Some(key);
		folded.push_str(value);
		if !drop_field {
			keep.push(line);
		}
	}
	if let Some(key) = field {
		apply_field(&key, &folded, &mut from, &mut recipients);
	}
	let from = from.ok_or_else(|| RequestError {
		message: "SMTP body must include a From header".into(),
	})?;
	recipients.sort();
	recipients.dedup();
	if recipients.is_empty() {
		return Err(RequestError {
			message: "SMTP body must include To, Cc or Bcc recipients".into(),
		});
	}
	Ok((
		from,
		recipients,
		format!("{}\r\n\r\n{}", keep.join("\r\n"), rest.trim_start_matches("\r\n")),
	))
}

fn emails(value: &str) -> Vec<String> {
	let mut out = Vec::new();
	for part in value.split(',') {
		if let (Some(a), Some(b)) = (part.find('<'), part.find('>')) {
			if a < b {
				out.push(part[a + 1..b].trim().to_string());
				continue;
			}
		}
		let token = part.trim().trim_matches('"');
		if token.contains('@') && !token.contains(' ') {
			out.push(token.to_string());
		}
	}
	out
}

fn dot_stuff(data: &str) -> String {
	let data = data.replace("\r\n", "\n").replace('\r', "\n").replace('\n', "\r\n");
	data
		.split("\r\n")
		.map(|line| {
			if line.starts_with('.') {
				format!(".{line}\r\n")
			} else {
				format!("{line}\r\n")
			}
		})
		.collect()
}

mod commands {
	use tauri::*;
	use tauri_otel_context::OtelContext;

	use super::*;

	#[command(async)]
	pub async fn mail_request(_otel: OtelContext, req: Request) -> std::result::Result<Response, RequestError> {
		drop(_otel);
		tauri::async_runtime::spawn_blocking(move || send(req))
			.await
			.map_err(|e| RequestError { message: e.to_string() })?
	}
}

pub fn init<R: Runtime>() -> tauri::plugin::TauriPlugin<R> {
	use commands::*;

	tauri::plugin::Builder::new("plugin-mail")
		.invoke_handler(tauri::generate_handler![mail_request])
		.build()
}
