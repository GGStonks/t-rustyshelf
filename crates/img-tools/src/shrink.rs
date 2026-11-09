use image::{DynamicImage, GenericImageView};

/// Resizes an image to target_width while preserving aspect ratio.
pub fn shrink(img: &DynamicImage, target_width: u32) -> DynamicImage {
    let (w, h) = img.dimensions();
    if target_width == 0 || target_width >= w {
        return img.clone();
    }
    let target_height = ((h as f64 * target_width as f64) / w as f64).round() as u32;
    img.resize_exact(
        target_width,
        target_height.max(1),
        image::imageops::FilterType::Lanczos3,
    )
}
