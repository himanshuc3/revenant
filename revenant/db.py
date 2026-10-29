import psycopg
from pgvector.psycopg import register_vector

from .config import env


def connect() -> psycopg.Connection:
    conn = psycopg.connect(env("DATABASE_URL"), autocommit=True)
    register_vector(conn)
    return conn
