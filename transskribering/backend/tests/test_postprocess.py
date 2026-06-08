from app.services.postprocess import (
    clean_text,
    format_timestamp,
    merge_with_overlap_dedup,
    split_into_paragraphs,
)


def test_clean_text_removes_simple_fillers():
    text = "Det er øh altså noget vi øhm må snakke om."
    out = clean_text(text)
    assert "øh" not in out.lower()
    assert "snakke" in out


def test_clean_text_removes_double_words():
    text = "Det er det det er noget vi vi gør."
    out = clean_text(text)
    assert "det det" not in out
    assert "vi vi" not in out


def test_merge_with_overlap_dedup_handles_overlap():
    a = "Vi har en lang sætning der slutter med samme ord som næste."
    b = "samme ord som næste. Og så fortsætter teksten her."
    merged = merge_with_overlap_dedup([a, b])
    # Overlap-fragmentet må ikke dukke op to gange
    assert merged.count("samme ord som næste") == 1


def test_split_into_paragraphs_splits_long_text():
    text = "Sætning et. Sætning to. Sætning tre. Sætning fire. Sætning fem. Sætning seks. Sætning syv."
    out = split_into_paragraphs(text, sentences_per_paragraph=3)
    assert "\n\n" in out


def test_format_timestamp():
    assert format_timestamp(0) == "[00:00:00]"
    assert format_timestamp(65) == "[00:01:05]"
    assert format_timestamp(3725.4) == "[01:02:05]"
