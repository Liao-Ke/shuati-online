from fastapi import FastAPI
from fastapi.staticfiles import StaticFiles
from database import engine, Base
from routers import auth, banks, exam, history, dashboard, wrong_answers, review

Base.metadata.create_all(bind=engine)

app = FastAPI(title="刷题在线", version="1.0.0")


@app.get("/api/health")
def health():
    return {"status": "ok"}


app.include_router(auth.router)
app.include_router(banks.router)
app.include_router(exam.router)
app.include_router(history.router)
app.include_router(dashboard.router)
app.include_router(wrong_answers.router)
app.include_router(review.router)
app.mount("/", StaticFiles(directory="static", html=True), name="static")
