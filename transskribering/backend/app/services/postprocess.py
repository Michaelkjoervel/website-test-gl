"""Efterbehandling: let rensning og fjernelse af overlap-dubletter mellem lyddele."""
from __future__ import annotations

import re
from difflib import SequenceMatcher
from typing import List

FILLERS = [
    r"\bøh+\b",
    r"\bøhm+\b",
    r"\bhmm+\b",
    r"\bæh+\b",
    r"\bnå+ja\b",
    r"\baltså\b",
]


def clean_text(text: str) -> str:
    """Let rensning: fjern fyldord og åbenlyse umiddelbare gentagelser, men bevar betydningen."""
    if not text:
        return text
    out = text
    for pattern in FILLERS:
        out = re.sub(pattern, "", out, flags=re.IGNORECASE)

    # Fjern umiddelbart gentagne ord ("og og", "jeg jeg")
    out = re.sub(r"\b(\w+)( \1\b)+", r"\1", out, flags=re.IGNORECASE)

    # Ryd op i tegnsætning og dobbelt mellemrum
    out = re.sub(r"\s+,", ",", out)
    out = re.sub(r"\s+\.", ".", out)
    out = re.sub(r" {2,}", " ", out)
    out = re.sub(r"\n{3,}", "\n\n", out)
    return out.strip()


def merge_with_overlap_dedup(chunk_texts: List[str], overlap_chars: int = 200) -> str:
    """Saml lyddele og fjern tydelige tekstdubletter forårsaget af lydoverlap."""
    chunk_texts = [t.strip() for t in chunk_texts if t and t.strip()]
    if not chunk_texts:
        return ""

    result = chunk_texts[0]
    for next_text in chunk_texts[1:]:
        result = _join_with_dedup(result, next_text, overlap_chars)
    return result


def _join_with_dedup(left: str, right: str, window: int) -> str:
    """Find længste fælles slut/start mellem to dele og kombinér uden dublet."""
    if not left:
        return right
    if not right:
        return left
    a_tail = left[-window:]
    b_head = right[: window]
    matcher = SequenceMatcher(None, a_tail.lower(), b_head.lower())
    match = matcher.find_longest_match(0, len(a_tail), 0, len(b_head))
    if match.size >= 20:  # mindst 20 tegn fælles for at tælle som overlap
        return left + right[match.b + match.size :]
    return left + "\n\n" + right


def split_into_paragraphs(text: str, sentences_per_paragraph: int = 4) -> str:
    """Bryd lang tekst i læsevenlige afsnit."""
    if not text:
        return text
    if "\n\n" in text:
        # antag at modellen allerede har lavet afsnit
        return text
    sentences = re.split(r"(?<=[.!?])\s+", text)
    paragraphs: list[str] = []
    buffer: list[str] = []
    for s in sentences:
        s = s.strip()
        if not s:
            continue
        buffer.append(s)
        if len(buffer) >= sentences_per_paragraph:
            paragraphs.append(" ".join(buffer))
            buffer = []
    if buffer:
        paragraphs.append(" ".join(buffer))
    return "\n\n".join(paragraphs)


def format_timestamp(seconds: float) -> str:
    seconds = max(0.0, float(seconds))
    h = int(seconds // 3600)
    m = int((seconds % 3600) // 60)
    s = int(seconds % 60)
    return f"[{h:02d}:{m:02d}:{s:02d}]"
