//! A refusal has to keep its name as it crosses from `gramax-fs` into `gramax-core`.
//!
//! `scan_workspace` and `scan_catalog` return `gramaxcore::Error`, not `IoError`, and the
//! frontend keys the access-denied dialog off the error's discriminant. Folding every I/O
//! failure into `Error::Io(String)` loses that discriminant, and a workspace on a
//! TCC-protected directory reports raw Debug text instead.

use std::io;
use std::io::ErrorKind;

use gramaxcore::Error;
use gramaxfs::error::IoError;

fn kind_of(err: &Error) -> String {
	serde_json::to_value(err).unwrap()["kind"].as_str().unwrap().to_owned()
}

#[test]
fn io_error_refusal_keeps_its_name() {
	let err = Error::from(IoError::from(io::Error::from(ErrorKind::PermissionDenied)));
	assert_eq!(kind_of(&err), "permissionDenied");
}

#[test]
fn std_io_refusal_keeps_its_name() {
	let err = Error::from(io::Error::from(ErrorKind::PermissionDenied));
	assert_eq!(kind_of(&err), "permissionDenied");
}

#[test]
fn other_io_failures_stay_io() {
	// The guard for the other direction: only the refusal gets its own name.
	assert_eq!(kind_of(&Error::from(IoError::from(io::Error::from(ErrorKind::NotFound)))), "io");
	assert_eq!(kind_of(&Error::from(io::Error::from(ErrorKind::TimedOut))), "io");
}
