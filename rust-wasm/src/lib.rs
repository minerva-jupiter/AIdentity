use std::{io:: Cursor, usize};
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

    let mut ans : String= "馬鹿なことを言ってないで。".to_string();

    match worker.num_tokens() {
        1..5 => {
            ans = "何を言っているの？".to_string();
        },
        5..10 => {
            ans = "そんなことができるわけないじゃない？".to_string();
        },
        10..=usize::MAX => {
            ans = "そんなこと思ってるんじゃないんでしょ？".to_string();
        }
        _ => {ans = "意味がわからない。".to_string();},
    }

    Ok(ans)
}
