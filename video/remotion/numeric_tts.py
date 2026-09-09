"""
Converts numbers, currency, percentages, years, and decades in a script
line into spelled-out words for TTS input -- ElevenLabs (and most TTS)
mispronounce raw digits inconsistently ("$240,000" has been read as
"two hundred forty thousand" OR "two forty thousand" OR mangled entirely
depending on surrounding punctuation). On-screen captions keep the compact
numeric form (e.g. "$240,000") -- this rewrite is ONLY for what gets sent
to the voice model.

Usage: from numeric_tts import spoken_text
       spoken_text("The building was listed at $240,000.")
       -> "The building was listed at two hundred forty thousand dollars."
"""
import re
from num2words import num2words

_DECADE_WORDS = {
    "00": "hundreds", "10": "tens", "20": "twenties", "30": "thirties",
    "40": "forties", "50": "fifties", "60": "sixties", "70": "seventies",
    "80": "eighties", "90": "nineties",
}


def _decade(match):
    year = match.group(1)  # e.g. "1970"
    century = year[:2]
    decade = year[2:]
    prefix = num2words(int(century))
    return f"{prefix} {_DECADE_WORDS[decade]}"


def _year(match):
    year = int(match.group(0))
    return num2words(year, to="year")


def _currency(match):
    amount = match.group(1).replace(",", "")
    scale = match.group(2)
    if "." in amount:
        num_words = num2words(float(amount))
    else:
        num_words = num2words(int(amount))
    parts = [num_words]
    if scale:
        parts.append(scale.lower())
    parts.append("dollars")
    return " ".join(parts)


def _percent(match):
    amount = match.group(1)
    if "." in amount:
        num_words = num2words(float(amount))
    else:
        num_words = num2words(int(amount))
    return f"{num_words} percent"


def _hyphen_number(match):
    num = int(match.group(1))
    rest = match.group(2)
    return f"{num2words(num)}-{rest}"


def _bare_number(match):
    num = match.group(0).replace(",", "")
    if "." in num:
        return num2words(float(num))
    return num2words(int(num))


def spoken_text(line: str) -> str:
    # decades: 1970s -> nineteen seventies (must run before the bare-year pattern)
    line = re.sub(r"\b(19\d0|20\d0)s\b", _decade, line)
    # plain 4-digit years: 1968 -> nineteen sixty-eight
    line = re.sub(r"\b(1[5-9]\d{2}|20\d{2})\b", _year, line)
    # currency: $240,000 / $2.3 million / $7 million
    line = re.sub(r"\$([\d,]+(?:\.\d+)?)(?:\s*(million|billion|thousand))?\b", _currency, line, flags=re.IGNORECASE)
    # percentages: 3% / 12.5%
    line = re.sub(r"\b(\d+(?:\.\d+)?)\s*%", _percent, line)
    # hyphenated number-word combos: 6-plex, 12-unit, 36-unit
    line = re.sub(r"\b(\d+)-(\w+)", _hyphen_number, line)
    # anything else that's still a bare integer/decimal (e.g. "20-something"
    # already handled above catches the hyphen case; this catches standalone
    # counts like "5 tenants" or "13 beats")
    line = re.sub(r"\b\d[\d,]*(?:\.\d+)?\b", _bare_number, line)
    return line


if __name__ == "__main__":
    tests = [
        "Arnold Schwarzenegger bought a six-unit building in the early 1970s.",
        "He arrived in the US in 1968 broke.",
        "The building was listed at $240,000. He put down about $27,500.",
        "He sold it for $2.3 million after buying it for $450,000.",
        "That's a 3% stake in a $750,000,000 portfolio.",
        "Five tenants covered the mortgage on a 6-plex.",
    ]
    for t in tests:
        print(f"  {t}\n  -> {spoken_text(t)}\n")
