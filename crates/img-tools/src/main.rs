mod cart;
mod crop;
pub mod lbindex;
mod rebrand;
mod shrink;
mod spine;

use base64::engine::general_purpose::STANDARD as BASE64;
use base64::Engine;
use image::DynamicImage;
use serde::{Deserialize, Serialize};
use std::io::{self, BufRead, Write};

#[derive(Deserialize)]
struct JobRequest {
    id: Option<u64>,
    mode: Option<String>,
    file: Option<String>,
    data: Option<String>,
    w: Option<u32>,
    front: Option<f32>,
    spine: Option<f32>,
    part: Option<String>,
    plat: Option<String>,
    sys: Option<String>,
    out: Option<String>,
}

#[derive(Serialize)]
struct JobResponse {
    id: Option<u64>,
    ok: bool,
    #[serde(skip_serializing_if = "Option::is_none")]
    data: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pages: Option<Vec<String>>,
    #[serde(skip_serializing_if = "Option::is_none")]
    err: Option<String>,
}

fn load_image(req: &JobRequest) -> Result<DynamicImage, String> {
    if let Some(ref path) = req.file {
        image::open(path).map_err(|e| format!("Failed to open image '{}': {}", path, e))
    } else if let Some(ref b64) = req.data {
        let clean = b64.strip_prefix("data:image/").map(|s| {
            if let Some(idx) = s.find(";base64,") {
                &s[idx + 8..]
            } else {
                s
            }
        }).unwrap_or(b64);
        let bytes = BASE64.decode(clean).map_err(|e| format!("Base64 decode error: {}", e))?;
        image::load_from_memory(&bytes).map_err(|e| format!("Failed to decode image from bytes: {}", e))
    } else {
        Err("Neither 'file' nor 'data' was provided".to_string())
    }
}

fn encode_jpeg(img: &DynamicImage, quality: u8) -> Result<Vec<u8>, String> {
    let mut buf = Vec::new();
    let mut encoder = image::codecs::jpeg::JpegEncoder::new_with_quality(&mut buf, quality);
    encoder.encode_image(img).map_err(|e| format!("JPEG encode error: {}", e))?;
    Ok(buf)
}

fn encode_png(img: &DynamicImage) -> Result<Vec<u8>, String> {
    let mut buf = Vec::new();
    img.write_to(&mut std::io::Cursor::new(&mut buf), image::ImageFormat::Png)
        .map_err(|e| format!("PNG encode error: {}", e))?;
    Ok(buf)
}

fn process_job(req: JobRequest) -> JobResponse {
    let id = req.id;
    let mode = req.mode.as_deref().unwrap_or("crop");

    let img = match load_image(&req) {
        Ok(i) => i,
        Err(e) => {
            return JobResponse {
                id,
                ok: false,
                data: None,
                pages: None,
                err: Some(e),
            };
        }
    };

    match mode {
        "shrink" => {
            let target_w = req.w.unwrap_or(800);
            let out_img = shrink::shrink(&img, target_w);
            match encode_jpeg(&out_img, 90) {
                Ok(bytes) => {
                    if let Some(ref out_path) = req.out {
                        if let Err(e) = std::fs::write(out_path, &bytes) {
                            return JobResponse { id, ok: false, data: None, pages: None, err: Some(e.to_string()) };
                        }
                    }
                    JobResponse {
                        id,
                        ok: true,
                        data: Some(BASE64.encode(&bytes)),
                        pages: None,
                        err: None,
                    }
                }
                Err(e) => JobResponse { id, ok: false, data: None, pages: None, err: Some(e) },
            }
        }
        "crop" => {
            let (left, right) = crop::crop_both(&img);
            match (encode_jpeg(&left, 90), encode_jpeg(&right, 90)) {
                (Ok(l_bytes), Ok(r_bytes)) => JobResponse {
                    id,
                    ok: true,
                    data: None,
                    pages: Some(vec![BASE64.encode(&l_bytes), BASE64.encode(&r_bytes)]),
                    err: None,
                },
                (Err(e), _) | (_, Err(e)) => JobResponse { id, ok: false, data: None, pages: None, err: Some(e) },
            }
        }
        "spine" => {
            let part = req.part.as_deref().unwrap_or("spine");
            match spine::cut_spine(&img, req.front, req.spine, part) {
                Some(cut) => match encode_jpeg(&cut, 92) {
                    Ok(bytes) => {
                        if let Some(ref out_path) = req.out {
                            if let Err(e) = std::fs::write(out_path, &bytes) {
                                return JobResponse { id, ok: false, data: None, pages: None, err: Some(e.to_string()) };
                            }
                        }
                        JobResponse {
                            id,
                            ok: true,
                            data: Some(BASE64.encode(&bytes)),
                            pages: None,
                            err: None,
                        }
                    }
                    Err(e) => JobResponse { id, ok: false, data: None, pages: None, err: Some(e) },
                },
                None => JobResponse {
                    id,
                    ok: false,
                    data: None,
                    pages: None,
                    err: Some(if part == "back" { "no back found".to_string() } else { "no spine found".to_string() }),
                },
            }
        }
        "rebrand" => {
            let plat = req.plat.as_deref().unwrap_or("ps5");
            let part = req.part.as_deref().unwrap_or("");
            match rebrand::rebrand(&img, plat, part) {
                Some(rebranded) => match encode_jpeg(&rebranded, 92) {
                    Ok(bytes) => {
                        if let Some(ref out_path) = req.out {
                            if let Err(e) = std::fs::write(out_path, &bytes) {
                                return JobResponse { id, ok: false, data: None, pages: None, err: Some(e.to_string()) };
                            }
                        }
                        JobResponse {
                            id,
                            ok: true,
                            data: Some(BASE64.encode(&bytes)),
                            pages: None,
                            err: None,
                        }
                    }
                    Err(e) => JobResponse { id, ok: false, data: None, pages: None, err: Some(e) },
                },
                None => JobResponse {
                    id,
                    ok: false,
                    data: None,
                    pages: None,
                    err: Some("not rebranded".to_string()),
                },
            }
        }
        "cart" => {
            let sys = req.sys.as_deref().unwrap_or("sw");
            let cart_img = cart::make_cart(&img, sys);
            match encode_png(&cart_img) {
                Ok(bytes) => {
                    if let Some(ref out_path) = req.out {
                        if let Err(e) = std::fs::write(out_path, &bytes) {
                            return JobResponse { id, ok: false, data: None, pages: None, err: Some(e.to_string()) };
                        }
                    }
                    JobResponse {
                        id,
                        ok: true,
                        data: Some(BASE64.encode(&bytes)),
                        pages: None,
                        err: None,
                    }
                }
                Err(e) => JobResponse { id, ok: false, data: None, pages: None, err: Some(e) },
            }
        }
        other => JobResponse {
            id,
            ok: false,
            data: None,
            pages: None,
            err: Some(format!("Unknown mode '{}'", other)),
        },
    }
}

fn run_worker() {
    let stdin = io::stdin();
    let mut stdout = io::stdout();

    for line in stdin.lock().lines() {
        let line = match line {
            Ok(l) => l,
            Err(_) => break,
        };
        let trimmed = line.trim();
        if trimmed.is_empty() {
            continue;
        }

        let resp = match serde_json::from_str::<JobRequest>(trimmed) {
            Ok(req) => process_job(req),
            Err(e) => JobResponse {
                id: None,
                ok: false,
                data: None,
                pages: None,
                err: Some(format!("JSON parse error: {}", e)),
            },
        };

        if let Ok(json) = serde_json::to_string(&resp) {
            let _ = writeln!(stdout, "{}", json);
            let _ = stdout.flush();
        }
    }
}

fn print_usage() {
    eprintln!("Usage: trustyshelf-imgtools [COMMAND / OPTIONS]");
    eprintln!("Commands:");
    eprintln!("  lbindex --xml <PATH> --out <PATH> --platforms <LIST> --version <V> [--shards <DIR>]");
    eprintln!("  lbshards --index <PATH> --dir <DIR>");
    eprintln!("Options:");
    eprintln!("  --worker                  Run in worker mode (read JSON from stdin)");
    eprintln!("  --mode <MODE>             Operation mode: shrink, crop, spine, rebrand, cart");
    eprintln!("  --file <PATH>             Input image file");
    eprintln!("  --out <PATH>              Output image file");
    eprintln!("  --width <WIDTH>           Target width (for shrink)");
    eprintln!("  --part <PART>             'spine' or 'back' (for spine, rebrand)");
    eprintln!("  --plat <PLAT>             Platform (for rebrand: ps5, xsx, ps4, sw)");
    eprintln!("  --sys <SYS>               System (for cart: sw, n3ds)");
    eprintln!("  --version                 Print version");
}

fn run_lbindex(args: &[String]) {
    let mut xml: Option<String> = None;
    let mut out: Option<String> = None;
    let mut platforms: Vec<String> = Vec::new();
    let mut version: u32 = 8;
    let mut shards_dir: Option<String> = None;

    let mut i = 0;
    while i < args.len() {
        match args[i].as_str() {
            "--xml" => {
                if i + 1 < args.len() { xml = Some(args[i + 1].clone()); i += 1; }
            }
            "--out" => {
                if i + 1 < args.len() { out = Some(args[i + 1].clone()); i += 1; }
            }
            "--platforms" => {
                if i + 1 < args.len() {
                    let val = &args[i + 1];
                    if val.starts_with('[') {
                        if let Ok(list) = serde_json::from_str::<Vec<String>>(val) {
                            platforms = list;
                        }
                    } else {
                        platforms = val.split(',').map(|s| s.trim().to_string()).filter(|s| !s.is_empty()).collect();
                    }
                    i += 1;
                }
            }
            "--version" => {
                if i + 1 < args.len() {
                    if let Ok(v) = args[i + 1].parse() { version = v; }
                    i += 1;
                }
            }
            "--shards" | "--shards-dir" => {
                if i + 1 < args.len() { shards_dir = Some(args[i + 1].clone()); i += 1; }
            }
            _ => {}
        }
        i += 1;
    }

    let xml_path = match xml {
        Some(x) => std::path::PathBuf::from(x),
        None => {
            println!("{{\"error\":\"Missing --xml argument\"}}");
            std::process::exit(1);
        }
    };
    let out_path = match out {
        Some(o) => std::path::PathBuf::from(o),
        None => {
            println!("{{\"error\":\"Missing --out argument\"}}");
            std::process::exit(1);
        }
    };

    let shards_path = shards_dir.map(std::path::PathBuf::from);

    let stdout = std::io::stdout();
    let on_pct = |pct: u32| {
        let mut handle = stdout.lock();
        let _ = writeln!(handle, "{{\"pct\":{}}}", pct);
        let _ = handle.flush();
    };

    match lbindex::build_index_file(&xml_path, &out_path, &platforms, version, shards_path.as_deref(), on_pct) {
        Ok(counts) => {
            println!("{{\"done\":true,\"counts\":{}}}", serde_json::to_string(&counts).unwrap());
        }
        Err(e) => {
            println!("{{\"error\":{}}}", serde_json::to_string(&e.to_string()).unwrap());
            std::process::exit(1);
        }
    }
}

fn run_lbshards(args: &[String]) {
    let mut index: Option<String> = None;
    let mut dir: Option<String> = None;

    let mut i = 0;
    while i < args.len() {
        match args[i].as_str() {
            "--index" => {
                if i + 1 < args.len() { index = Some(args[i + 1].clone()); i += 1; }
            }
            "--dir" => {
                if i + 1 < args.len() { dir = Some(args[i + 1].clone()); i += 1; }
            }
            _ => {}
        }
        i += 1;
    }

    let idx_path = match index {
        Some(p) => std::path::PathBuf::from(p),
        None => {
            println!("{{\"error\":\"Missing --index argument\"}}");
            std::process::exit(1);
        }
    };
    let dir_path = match dir {
        Some(d) => std::path::PathBuf::from(d),
        None => {
            println!("{{\"error\":\"Missing --dir argument\"}}");
            std::process::exit(1);
        }
    };

    match lbindex::split_index_file(&idx_path, &dir_path) {
        Ok(()) => {
            println!("{{\"split\":true}}");
        }
        Err(e) => {
            println!("{{\"error\":{}}}", serde_json::to_string(&e.to_string()).unwrap());
            std::process::exit(1);
        }
    }
}

fn main() {
    let args: Vec<String> = std::env::args().collect();
    if args.iter().any(|a| a == "--worker") {
        run_worker();
        return;
    }

    if args.len() > 1 && (args[1] == "lbindex" || args[1] == "--lbindex") {
        run_lbindex(&args[2..]);
        return;
    }

    if args.len() > 1 && (args[1] == "lbshards" || args[1] == "--lbshards") {
        run_lbshards(&args[2..]);
        return;
    }

    if args.len() < 2 || args.iter().any(|a| a == "--help" || a == "-h") {
        print_usage();
        return;
    }

    if args.iter().any(|a| a == "--version") {
        println!("trustyshelf-imgtools {}", env!("CARGO_PKG_VERSION"));
        return;
    }

    // CLI mode parser
    let mut req = JobRequest {
        id: Some(1),
        mode: None,
        file: None,
        data: None,
        w: None,
        front: None,
        spine: None,
        part: None,
        plat: None,
        sys: None,
        out: None,
    };

    let mut i = 1;
    while i < args.len() {
        match args[i].as_str() {
            "--mode" => {
                if i + 1 < args.len() { req.mode = Some(args[i + 1].clone()); i += 1; }
            }
            "--file" => {
                if i + 1 < args.len() { req.file = Some(args[i + 1].clone()); i += 1; }
            }
            "--out" => {
                if i + 1 < args.len() { req.out = Some(args[i + 1].clone()); i += 1; }
            }
            "--width" => {
                if i + 1 < args.len() { req.w = args[i + 1].parse().ok(); i += 1; }
            }
            "--part" => {
                if i + 1 < args.len() { req.part = Some(args[i + 1].clone()); i += 1; }
            }
            "--plat" => {
                if i + 1 < args.len() { req.plat = Some(args[i + 1].clone()); i += 1; }
            }
            "--sys" => {
                if i + 1 < args.len() { req.sys = Some(args[i + 1].clone()); i += 1; }
            }
            m if !m.starts_with("--") && req.mode.is_none() => {
                req.mode = Some(m.to_string());
            }
            _ => {}
        }
        i += 1;
    }

    let resp = process_job(req);
    if !resp.ok {
        eprintln!("Error: {}", resp.err.unwrap_or_else(|| "Unknown error".to_string()));
        std::process::exit(1);
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use image::{Rgba, RgbaImage};

    #[test]
    fn test_shrink_operation() {
        let mut img = RgbaImage::new(100, 200);
        for pixel in img.pixels_mut() {
            *pixel = Rgba([100, 150, 200, 255]);
        }
        let dynamic = DynamicImage::ImageRgba8(img);
        let shrunk = shrink::shrink(&dynamic, 50);
        assert_eq!(shrunk.width(), 50);
        assert_eq!(shrunk.height(), 100);
    }

    #[test]
    fn test_crop_operation() {
        let mut img = RgbaImage::new(200, 100);
        for pixel in img.pixels_mut() {
            *pixel = Rgba([100, 150, 200, 255]);
        }
        let dynamic = DynamicImage::ImageRgba8(img);
        let (left, right) = crop::crop_both(&dynamic);
        assert_eq!(left.width(), 100);
        assert_eq!(left.height(), 100);
        assert_eq!(right.width(), 100);
        assert_eq!(right.height(), 100);
    }

    #[test]
    fn test_spine_cut_operation() {
        // Create an artificial full wrap: width 1500, height 1000 (ratio 1.5)
        // Back: 0..700, Spine: 700..800, Front: 800..1500
        let mut img = RgbaImage::new(1500, 1000);
        for (x, y, pixel) in img.enumerate_pixels_mut() {
            if x < 700 {
                *pixel = Rgba([50, 50, 50, 255]);
            } else if x < 800 {
                *pixel = Rgba([200, 200, 200, 255]); // distinct spine
            } else {
                *pixel = Rgba([50, 50, 50, 255]);
            }
            if y < 50 {
                // border
                *pixel = Rgba([0, 0, 0, 255]);
            }
        }
        let dynamic = DynamicImage::ImageRgba8(img);
        let spine_cut = spine::cut_spine(&dynamic, Some(0.71), Some(0.074), "spine");
        assert!(spine_cut.is_some());
        let back_cut = spine::cut_spine(&dynamic, Some(0.71), Some(0.074), "back");
        assert!(back_cut.is_some());
    }

    #[test]
    fn test_cart_operation() {
        let mut img = RgbaImage::new(400, 600);
        for pixel in img.pixels_mut() {
            *pixel = Rgba([255, 0, 0, 255]);
        }
        let dynamic = DynamicImage::ImageRgba8(img);
        let cart_sw = cart::make_cart(&dynamic, "sw");
        assert_eq!(cart_sw.height(), 1000);
        assert_eq!(cart_sw.width(), 677);

        let cart_3ds = cart::make_cart(&dynamic, "n3ds");
        assert_eq!(cart_3ds.height(), 1000);
        assert_eq!(cart_3ds.width(), 1061);
    }
}
