from functools import lru_cache

from fastembed import TextEmbedding

MODEL = "BAAI/bge-small-en-v1.5"
DIM = 384


@lru_cache
def _model() -> TextEmbedding:
    return TextEmbedding(MODEL)


def embed(text: str) -> list[float]:
    vector = [float(x) for x in next(iter(_model().embed([text])))]
    if len(vector) != DIM:
        raise RuntimeError(f"{MODEL} returned {len(vector)} dims, schema expects {DIM}")
    return vector
