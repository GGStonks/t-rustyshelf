use image::{DynamicImage, GenericImageView};

/// Splits a two-page scan into its left and right halves.
pub fn crop_both(img: &DynamicImage) -> (DynamicImage, DynamicImage) {
    let (w, h) = img.dimensions();
    let half = w / 2;
    let left = img.crop_imm(0, 0, half, h);
    let right = img.crop_imm(w - half, 0, half, h);
    (left, right)
}
