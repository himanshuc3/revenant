from revenant.signature import from_event, normalize_file, template_message


def event(frames, type_="TypeError", value="x"):
    return {"entries": [{"type": "exception", "data": {"values": [
        {"type": type_, "value": value, "stacktrace": {"frames": frames}}]}}]}


def test_template_replaces_numbers_ids_urls():
    msg = "Field 42 not found at http://localhost:5173/a?b=1 for 3f2b8c1e-aaaa-bbbb-cccc-1234567890ab"
    assert template_message(msg) == "Field <n> not found at <url> for <id>"


def test_bundle_hash_and_leading_slash_stripped():
    assert normalize_file("/node_modules/.vite/deps/react-dom-BCNX9mNN.js") == "node_modules/.vite/deps/react-dom.js"


def test_top_frame_is_last_in_app_and_function_prefix_dropped():
    frames = [
        {"filename": "/node_modules/.vite/deps/antd.js", "function": None, "inApp": False},
        {"filename": "/src/pages/HomePage.tsx", "function": "Object.onClick", "inApp": True},
    ]
    sig = from_event(event(frames, "Error", "This is your first error!"))
    assert (sig.top_file, sig.top_function) == ("src/pages/HomePage.tsx", "onClick")
    assert sig.key == "Error|This is your first error!|src/pages/HomePage.tsx|onClick"


def test_no_exception_returns_none():
    assert from_event({"entries": []}) is None
