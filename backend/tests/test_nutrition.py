from nutrition import clean_query, matches, relevance


def test_clean_query_removes_search_syntax():
    assert clean_query("90/10 ground beef") == "90 10 ground beef"


def test_clean_query_keeps_normal_text():
    assert clean_query("ground beef 90% lean") == "ground beef 90% lean"


def test_plurals_match_but_with_does_not_match_without():
    assert matches("potato", ["potatoes"])
    assert not matches("with", ["without"])


def test_raw_food_outranks_babyfood():
    words = ["sweet", "potato"]
    raw = {"description": "Sweet potatoes, orange flesh, without skin, raw", "dataType": "Foundation"}
    baby = {"description": "Babyfood, vegetables, sweet potatoes strained", "dataType": "SR Legacy"}
    assert relevance(raw, words) > relevance(baby, words)


def test_matching_every_word_outranks_partial_match():
    words = ["sweet", "potato"]
    sweet = {"description": "Sweet potato, cooked, boiled, without skin"}
    regular = {"description": "Potatoes, russet, without skin, raw", "dataType": "Foundation"}
    assert relevance(sweet, words) > relevance(regular, words)