//! Generates the Kotlin/Swift bindings from the built library:
//! `cargo run --bin uniffi-bindgen generate --library <dylib> --language kotlin --out-dir <dir>`
fn main() {
    uniffi::uniffi_bindgen_main()
}
