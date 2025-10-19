use std::io::Cursor;
use vibrato::{Dictionary, Tokenizer};
use wasm_bindgen::prelude::*;

#[wasm_bindgen]
pub fn chat(dict_data: &[u8], input: &str) -> Result<String, JsValue> {
    let encoded = Cursor::new(dict_data);
    let reader = zstd::Decoder::new(encoded).unwrap();
    let dict = Dictionary::read(reader)
        .map_err(|_|{JsValue::from(js_sys::Error::new("Dictionary road Error"))})?;
    let tokenizer = Tokenizer::new(dict);
    let mut worker = tokenizer.new_worker();

    worker.reset_sentence(input);
    worker.tokenize();

    let ans : String= "馬鹿なことを言ってないで。".to_string();
    Ok(ans)
}
