use rand::Rng;
use std::{io::Cursor, iter::Peekable, str::SplitWhitespace, usize};
use vibrato::{Dictionary, Tokenizer};
use wasm_bindgen::prelude::*;

#[wasm_bindgen]
pub fn chat(dict_data: &[u8], input: &str) -> Result<String, JsValue> {
    let encoded = Cursor::new(dict_data);
    let reader = zstd::Decoder::new(encoded).unwrap();
    let dict = Dictionary::read(reader)
        .map_err(|_| JsValue::from(js_sys::Error::new("Dictionary road Error")))?;
    let tokenizer = Tokenizer::new(dict);
    let mut worker = tokenizer.new_worker();
    let mut rng = rand::rng();
    let random_number = rng.random_range(1..=2);

    worker.reset_sentence(input);
    worker.tokenize();

    let mut ans: String = if random_number == 1 {
        "どうせ失敗する。当たり前だ。そうに決まっている。".to_string()
    } else {
        "馬鹿なことを言ってないで。".to_string()
    };

    match worker.num_tokens() {
        1..5 => {
            ans = if random_number == 1 {
                "は？".to_string()
            } else {
                "何を言っているの？".to_string()
            };
        }
        5..9 => {
            ans = if random_number == 1 {
                "期待した私が馬鹿だったの？".to_string()
            } else {
                "そんなことができるわけないじゃない？".to_string()
            };
        }
        9 => {
            ans = if random_number == 1 {
                "お前のせいで私の人生がめちゃくちゃだ。".to_string()
            } else {
                "そんなこと思ってるんじゃないんでしょ？".to_string()
            };
        }
        10..=usize::MAX => {
            ans = if random_number == 1 {
                "どうでもいいわ。勝手にすれば。私には関係ない。".to_string()
            } else {
                "意味がわからない。".to_string()
            };
        }
        _ => {
            ans = "どうでもいいわ。勝手にすれば。私には関係ない。".to_string();
        }
    }

    Ok(ans)
}

use kurbo::ParamCurveNearest;
use kurbo::{BezPath, ParamCurve, PathSeg, Point, Vec2};
use std::f64::consts::PI;
use wasm_bindgen::JsValue;

// TypeScriptのPoint型に対応する構造体を定義
#[derive(Debug, Clone, Copy)]
#[wasm_bindgen]
pub struct NearestPointResult {
    pub x: f64,
    pub y: f64,
}

// -------------------------------------------------------------------------
// 🛠️ Arc to Bezier 変換ヘルパ
// -------------------------------------------------------------------------

/// ベクトルVを回転角度φだけ回転させます。（名前を rotate_vec2 に変更）
fn rotate_vec2(v: Vec2, sin_phi: f64, cos_phi: f64) -> Vec2 {
    Vec2::new(v.x * cos_phi - v.y * sin_phi, v.x * sin_phi + v.y * cos_phi)
}

/// 単一のArcセグメント（2つの角度間）をCubic Bezierに変換します。
fn segment_to_cubic(
    center: Point,
    radii: Point, // (rx, ry)
    phi: f64,     // x軸回転角度
    start_angle: f64,
    delta_angle: f64,
    path: &mut BezPath,
    current_point: Point,
) -> Point {
    if delta_angle.abs() < 1e-6 {
        return current_point;
    }

    let t_factor = 4.0 / 3.0 * (delta_angle / 4.0).tan();

    let a = radii.x;
    let b = radii.y;
    let cos_phi = phi.cos();
    let sin_phi = phi.sin();

    // Vec2として扱う
    let start_vec = Vec2::new(start_angle.cos() * a, start_angle.sin() * b);
    let end_vec = Vec2::new(
        (start_angle + delta_angle).cos() * a,
        (start_angle + delta_angle).sin() * b,
    );

    // Vec2を回転
    let start_vec_rotated = rotate_vec2(start_vec, sin_phi, cos_phi);
    let end_vec_rotated = rotate_vec2(end_vec, sin_phi, cos_phi);

    let p0 = center + start_vec_rotated;
    let p3 = center + end_vec_rotated;

    // Vec2 を使ったタンジェント計算
    let t_start_vec = Vec2::new(-start_vec.y * t_factor, start_vec.x * t_factor);
    let t_end_vec = Vec2::new(end_vec.y * t_factor, -end_vec.x * t_factor);

    // Vec2を回転
    let t_start = rotate_vec2(t_start_vec, sin_phi, cos_phi);
    let t_end = rotate_vec2(t_end_vec, sin_phi, cos_phi);

    let p1 = p0 + t_start;
    let p2 = p3 + t_end;

    path.curve_to(p1, p2, p3);
    p3
}

/// SVG Arcコマンドを複数のCubic Bezierセグメントに分解します。
fn arc_to_beziers(
    start_point: Point,
    mut rx: f64,
    mut ry: f64,
    x_axis_rotation: f64,
    large_arc_flag: bool,
    sweep_flag: bool,
    end_point: Point,
    path: &mut BezPath,
) -> Point {
    if (rx.abs() < 1e-6 || ry.abs() < 1e-6) || start_point == end_point {
        path.line_to(end_point);
        return end_point;
    }

    rx = rx.abs();
    ry = ry.abs();

    let phi = x_axis_rotation * PI / 180.0;
    let cos_phi = phi.cos();
    let sin_phi = phi.sin();

    // Vec2を回転し、結果も Vec2
    let p_vec = (start_point - end_point) * 0.5;
    let p_prime_vec = rotate_vec2(p_vec, -sin_phi, cos_phi);
    // Pointとして使うために一時的に変換
    let p_prime = Point::new(p_prime_vec.x, p_prime_vec.y);

    let lambda = p_prime.x * p_prime.x / (rx * rx) + p_prime.y * p_prime.y / (ry * ry);
    if lambda > 1.0 {
        let root = lambda.sqrt();
        rx *= root;
        ry *= root;
    }

    let rx_sq = rx * rx;
    let ry_sq = ry * ry;
    let x_prime_sq = p_prime.x * p_prime.x;
    let y_prime_sq = p_prime.y * p_prime.y;

    let mut center_coeff = ((rx_sq * ry_sq - rx_sq * y_prime_sq - ry_sq * x_prime_sq)
        / (rx_sq * y_prime_sq + ry_sq * x_prime_sq))
        .max(0.0)
        .sqrt();

    if large_arc_flag == sweep_flag {
        center_coeff = -center_coeff;
    }

    let center_prime = Vec2::new(
        // 中心C'は変位なのでVec2で表現
        center_coeff * rx * p_prime.y / ry,
        center_coeff * -ry * p_prime.x / rx,
    );

    let center_midpoint_vec: Vec2 = (start_point - Point::ZERO + end_point.to_vec2()) * 0.5;
    let midpoint: Point = Point::new(center_midpoint_vec.x, center_midpoint_vec.y);

    // C' (Vec2) を回転
    let center_prime_rotated = rotate_vec2(center_prime, sin_phi, cos_phi);

    // 中点 (Point) + 回転変位 (Vec2) = 最終的な中心 (Point)
    let center: Point = midpoint + center_prime_rotated;

    // 7. 角度の計算
    let to_angle = |p: Point| -> f64 {
        let mut angle = (p.y).atan2(p.x);
        if angle < 0.0 {
            angle += 2.0 * PI;
        }
        angle
    };

    // 始点と終点の角度を計算 (Pointを使って角度を求める)
    let start_vec_p = Point::new(
        (p_prime.x - center_prime.x) / rx,
        (p_prime.y - center_prime.y) / ry,
    );
    let start_angle = to_angle(start_vec_p);

    let end_vec_p = Point::new(
        (-p_prime.x - center_prime.x) / rx,
        (-p_prime.y - center_prime.y) / ry,
    );
    let end_angle = to_angle(end_vec_p);

    // 角度差の計算
    let mut delta_angle = end_angle - start_angle;
    if !sweep_flag && delta_angle > 0.0 {
        delta_angle -= 2.0 * PI;
    } else if sweep_flag && delta_angle < 0.0 {
        delta_angle += 2.0 * PI;
    }

    let num_segments = (delta_angle.abs() / (PI / 2.0)).ceil() as i32;
    let segment_delta = delta_angle / num_segments as f64;

    let mut current_arc_angle = start_angle;
    let mut current_p = start_point;

    for _ in 0..num_segments {
        let next_angle = current_arc_angle + segment_delta;

        current_p = segment_to_cubic(
            center,
            Point::new(rx, ry),
            phi,
            current_arc_angle,
            segment_delta,
            path,
            current_p,
        );

        current_arc_angle = next_angle;
    }

    end_point
}

// ... (残りの関数は変更なし) ...

/// SVG Path Data (d attribute) を解析し、kurbo::BezPathに変換します。
fn parse_svg_path_to_bezpath(path_d: &str) -> Option<BezPath> {
    let mut path = BezPath::new();

    let binding = path_d.replace(',', " ");

    let mut tokens: Peekable<SplitWhitespace> = binding.split_whitespace().peekable();

    let mut current_point = Point::new(0.0, 0.0);
    let mut subpath_start = Point::new(0.0, 0.0);

    let get_f64 = |tokens: &mut Peekable<SplitWhitespace>| -> Option<f64> {
        tokens.next().and_then(|s| s.parse::<f64>().ok())
    };

    while let Some(token) = tokens.next() {
        let command = token.to_uppercase();

        match command.as_str() {
            "M" => {
                let x = get_f64(&mut tokens)?;
                let y = get_f64(&mut tokens)?;
                current_point = Point::new(x, y);
                subpath_start = current_point;
                path.move_to(current_point);

                while tokens.peek().and_then(|t| t.parse::<f64>().ok()).is_some() {
                    let x = get_f64(&mut tokens)?;
                    let y = get_f64(&mut tokens)?;
                    current_point = Point::new(x, y);
                    path.line_to(current_point);
                }
            }
            "L" => {
                let x = get_f64(&mut tokens)?;
                let y = get_f64(&mut tokens)?;
                current_point = Point::new(x, y);
                path.line_to(current_point);
            }
            "C" => {
                let x1 = get_f64(&mut tokens)?;
                let y1 = get_f64(&mut tokens)?;
                let x2 = get_f64(&mut tokens)?;
                let y2 = get_f64(&mut tokens)?;
                let x = get_f64(&mut tokens)?;
                let y = get_f64(&mut tokens)?;

                let p1 = Point::new(x1, y1);
                let p2 = Point::new(x2, y2);
                current_point = Point::new(x, y);

                path.curve_to(p1, p2, current_point);
            }
            "A" => {
                let rx = get_f64(&mut tokens)?;
                let ry = get_f64(&mut tokens)?;
                let x_axis_rotation = get_f64(&mut tokens)?;
                let large_arc_flag = get_f64(&mut tokens)? != 0.0;
                let sweep_flag = get_f64(&mut tokens)? != 0.0;
                let x = get_f64(&mut tokens)?;
                let y = get_f64(&mut tokens)?;
                let end_point = Point::new(x, y);

                // Arc to Bezier 変換ロジックを呼び出し
                current_point = arc_to_beziers(
                    current_point,
                    rx,
                    ry,
                    x_axis_rotation,
                    large_arc_flag,
                    sweep_flag,
                    end_point,
                    &mut path,
                );
            }
            "Z" => {
                path.close_path();
                current_point = subpath_start;
            }
            _ => {
                return None;
            }
        }
    }
    Some(path)
}

/**
 * SVGパス上で指定された点に最も近い点を計算します。
 */
#[wasm_bindgen]
pub fn find_nearest_point_on_path(
    path_d: &str,
    x: f64,
    y: f64,
    _snapping_distance_viewbox: f64,
) -> Option<NearestPointResult> {
    let target_point = Point::new(x, y);

    let bez_path = parse_svg_path_to_bezpath(path_d)?;

    let mut closest_point: Option<Point> = None;
    let mut min_dist_sq: f64 = f64::MAX;

    // PathSegのバリアントからジオメトリ型（Line, CubicBez）を抽出
    for segment in bez_path.segments() {
        let new_closest_point = match segment {
            // Line構造体を抽出
            PathSeg::Line(line) => {
                // nearest_param の代わりに nearest を使用し、accuracy に 1.0 (デフォルト値) を渡す
                let nearest_result = line.nearest(target_point, 1.0);
                let dist_sq = nearest_result.distance_sq;

                if dist_sq < min_dist_sq {
                    min_dist_sq = dist_sq;
                    // nearest_result.point は非公開なので、eval(param) を使用する
                    Some(line.eval(nearest_result.t))
                } else {
                    None
                }
            }
            // CubicBez構造体を抽出
            PathSeg::Cubic(cubic_bez) => {
                let nearest_result = cubic_bez.nearest(target_point, 1.0);
                let dist_sq = nearest_result.distance_sq;

                if dist_sq < min_dist_sq {
                    min_dist_sq = dist_sq;
                    Some(cubic_bez.eval(nearest_result.t))
                } else {
                    None
                }
            }
            // Quad Bezier (サポート外) およびその他のバリアントはスキップ
            _ => None,
        };

        if new_closest_point.is_some() {
            closest_point = new_closest_point;
        }
    }

    // 4. 結果の返却
    if let Some(p) = closest_point {
        return Some(NearestPointResult { x: p.x, y: p.y });
    } else {
        return Some(NearestPointResult { x: 500.0, y: 500.0 });
    }

    Some(NearestPointResult { x: 0.0, y: 0.0 })
}

// WASMの初期化関数 (必須)
#[wasm_bindgen(start)]
pub fn main_js() -> Result<(), JsValue> {
    Ok(())
}
