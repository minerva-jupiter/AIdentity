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

#[wasm_bindgen]
pub struct NearestPointResult {
    x: f64,
    y: f64,
}

#[wasm_bindgen]
impl NearestPointResult {
    pub fn new(x: f64, y: f64) -> NearestPointResult {
        NearestPointResult { x, y }
    }

    #[wasm_bindgen(getter)]
    pub fn x(&self) -> f64 { self.x }
    #[wasm_bindgen(getter)]
    pub fn y(&self) -> f64 { self.y }
}

#[wasm_bindgen]
pub fn find_nearest_point_on_path(
    path_d: &str,       // 背景SVGのパスデータ (d属性)
    target_x: f64,      // ユーザー描画点のX座標
    target_y: f64,      // ユーザー描画点のY座標
    max_snapping_distance: f64 // 吸着距離の閾値
) -> Option<NearestPointResult> {
    
    let target_point = (target_x, target_y);

    // 1. パスのパース: 
    //    path_d をベジェ曲線セグメントのリストに変換
    //    let segments = svgtypes::PathParser::from(path_d).collect(); 

    let mut min_distance_sq = f64::MAX;
    let max_distance_sq = max_snapping_distance * max_snapping_distance;
    let mut nearest_point: Option<(f64, f64)> = None;

    // 2. 最短距離計算 (各セグメントに対して実行)
    //    - 擬似コード: 実際にはベジェ曲線と点の最短距離を計算する幾何学的アルゴリズムが必要。
    //    - 非常に複雑なため、ここでは単純にパスを多数の点にサンプリングして探索するアプローチを想定。
    //
    //    for segment in segments {
    //        let (closest_pt_on_seg, dist_sq) = segment.find_closest_point(target_point);
    //        if dist_sq < min_distance_sq {
    //            min_distance_sq = dist_sq;
    //            nearest_point = Some(closest_pt_on_seg);
    //        }
    //    }


    // --- 暫定的なシンプルなサンプリングロジックの代替（実際のプロダクトでは置き換えが必要） ---
    // ここでは、ダミーの矩形パス (M100 100 L400 100 L400 400 L100 400 Z) をサンプリングした点を仮定します。
    // このダミーは、WASMが正しく動作することを示すためのものです。
    let dummy_edge_points = vec![
        (100.0, 100.0), (150.0, 100.0), (200.0, 100.0), /* ... */
    ];
    
    for (ex, ey) in dummy_edge_points {
        let dx = ex - target_x;
        let dy = ey - target_y;
        let dist_sq = dx * dx + dy * dy;

        if dist_sq < min_distance_sq {
            min_distance_sq = dist_sq;
            nearest_point = Some((ex, ey));
        }
    }
    // ---------------------------------------------------------------------------------


    if min_distance_sq < max_distance_sq {
        if let Some((x, y)) = nearest_point {
            return Some(NearestPointResult::new(x, y));
        }
    }

    // 吸着範囲外、または計算不能
    None
}
