from fastapi import FastAPI, HTTPException, Depends, UploadFile, File
from fastapi.security import OAuth2PasswordBearer, OAuth2PasswordRequestForm
from fastapi.staticfiles import StaticFiles
from sqlalchemy.orm import Session
from passlib.context import CryptContext
from jose import JWTError, jwt
from datetime import datetime, timedelta
from database import get_db
from models import User, Follow, Post
from schema import TokenPair, UserCreate, UserLogin, UserUpdate
from database import engine, Base, SessionLocal
import uuid
import os
import shutil
from fastapi.middleware.cors import CORSMiddleware

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ── Serve uploaded files as static ──────────────────────
os.makedirs("uploads", exist_ok=True)
app.mount("/uploads", StaticFiles(directory="uploads"), name="uploads")

# --- Config ---
SECRET_KEY = "fbab35ec4019c91b7d06cd19a0e7290ca81d7b6bed0ea43e1fdcfa7128e7c1f2"
ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_MINUTES = 30

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")

import bcrypt


def hash_password(password: str):
    pwd_bytes = password.encode('utf-8')
    salt = bcrypt.gensalt()
    hashed_password = bcrypt.hashpw(pwd_bytes, salt)
    return hashed_password.decode('utf-8')


def verify_password(plain_password: str, hashed_password: str):
    password_byte_enc = plain_password.encode('utf-8')
    hashed_password_byte_enc = hashed_password.encode('utf-8')
    return bcrypt.checkpw(password_byte_enc, hashed_password_byte_enc)


def create_access_token(data: dict, expires_delta: timedelta = None):
    to_encode = data.copy()
    expire = datetime.utcnow() + (expires_delta if expires_delta else timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES))
    to_encode.update({"exp": expire})
    encoded_jwt = jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)
    return encoded_jwt


def decode_access_token(token: str):
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        return payload
    except JWTError:
        return None


Base.metadata.create_all(bind=engine)

oauth2_scheme = OAuth2PasswordBearer(tokenUrl="login")


def get_current_user(token: str = Depends(oauth2_scheme), db: Session = Depends(get_db)):
    payload = decode_access_token(token)
    if payload is None:
        raise HTTPException(status_code=401, detail="Invalid token")

    user_id = payload.get("sub")
    user = db.query(User).filter(User.id == user_id).first()

    if not user:
        raise HTTPException(status_code=401, detail="User not found")

    return user


# ── AUTH ─────────────────────────────────────────────────

@app.post("/signup")
def signup(user: UserCreate, db: Session = Depends(get_db)):
    existing = db.query(User).filter(User.username == user.username).first()
    if existing:
        raise HTTPException(status_code=400, detail="User already exists")

    hashed_password = hash_password(user.password)
    new_user = User(
        id=str(uuid.uuid4()),
        username=user.username,
        email=user.email,
        password=hashed_password,
        full_name=user.full_name,
        university=user.university,
        department=user.department,
        bio=user.bio,
    )

    try:
        db.add(new_user)
        db.commit()
        db.refresh(new_user)
    except Exception as e:
        db.rollback()
        print(f"Database Error: {e}")
        raise HTTPException(status_code=500, detail="Database insertion failed")

    return {"message": "User created successfully"}


@app.post("/login", response_model=TokenPair)
def login(user: UserLogin, db: Session = Depends(get_db)):
    db_user = db.query(User).filter(User.username == user.username).first()

    if not db_user or not verify_password(user.password, db_user.password):
        raise HTTPException(status_code=401, detail="Invalid username or password")

    access_token = create_access_token(data={"sub": db_user.id})
    refresh_token = create_access_token(
        data={"sub": db_user.id},
        expires_delta=timedelta(days=7)
    )

    return {
        "access_token": access_token,
        "refresh_token": refresh_token,
        "token_type": "bearer"
    }


@app.post("/refresh", response_model=TokenPair)
def refresh_token(refresh_token: str, db: Session = Depends(get_db)):
    try:
        payload = jwt.decode(refresh_token, SECRET_KEY, algorithms=[ALGORITHM])
        username: str = payload.get("sub")
        if username is None:
            raise HTTPException(status_code=401, detail="Invalid refresh token")
    except JWTError:
        raise HTTPException(status_code=401, detail="Refresh token expired")

    user = db.query(User).filter(User.username == username).first()
    if not user:
        raise HTTPException(status_code=401, detail="User not found")

    new_access_token = create_access_token(data={"sub": user.id})

    return {
        "access_token": new_access_token,
        "refresh_token": refresh_token,
        "token_type": "bearer"
    }


# ── USERS ─────────────────────────────────────────────────

@app.get("/users/id/{user_id}")
def get_user_by_id(user_id: str, db: Session = Depends(get_db)):
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    return user


# ── UPDATE PROFILE ────────────────────────────────────────
# Called by edit.tsx when user taps "Done"
@app.patch("/users/{user_id}")
def update_user(
    user_id: str,
    updates: UserUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    # Only allow users to update their own profile
    if current_user.id != user_id:
        raise HTTPException(status_code=403, detail="Not allowed to edit another user's profile")

    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    # Check username uniqueness if it's being changed
    if updates.username and updates.username != user.username:
        taken = db.query(User).filter(User.username == updates.username).first()
        if taken:
            raise HTTPException(status_code=400, detail="Username already taken")

    # Apply only the fields that were actually sent (not None)
    if updates.full_name is not None:
        user.full_name = updates.full_name
    if updates.username is not None:
        user.username = updates.username
    if updates.bio is not None:
        user.bio = updates.bio
    if updates.department is not None:
        user.department = updates.department
    if updates.university is not None:
        user.university = updates.university

    db.commit()
    db.refresh(user)

    return {"message": "Profile updated", "user": {
        "id": user.id,
        "username": user.username,
        "full_name": user.full_name,
        "bio": user.bio,
        "department": user.department,
        "university": user.university,
        "profile_pic": user.profile_pic,
    }}


# ── UPLOAD PROFILE PICTURE ────────────────────────────────
# Called by edit.tsx after the text fields are saved, if user picked a new photo
@app.post("/users/{user_id}/profile-pic")
async def upload_profile_pic(
    user_id: str,
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    if current_user.id != user_id:
        raise HTTPException(status_code=403, detail="Not allowed")

    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    # Save the file to /uploads/profile_pics/
    os.makedirs("uploads/profile_pics", exist_ok=True)
    ext = file.filename.split(".")[-1] if "." in file.filename else "jpg"
    filename = f"{user_id}.{ext}"
    filepath = f"uploads/profile_pics/{filename}"

    with open(filepath, "wb") as buffer:
        shutil.copyfileobj(file.file, buffer)

    # Save the public URL in the DB
    # This URL will be accessible as http://192.168.100.22:8000/uploads/profile_pics/{filename}
    public_url = f"http://192.168.100.22:8000/uploads/profile_pics/{filename}"
    user.profile_pic = public_url

    db.commit()

    return {"message": "Profile picture updated", "profile_pic": public_url}


# ── FOLLOW ────────────────────────────────────────────────

@app.post("/follow/{user_id}")
def follow_user(
    user_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    if current_user.id == user_id:
        raise HTTPException(status_code=400, detail="You cannot follow yourself")

    existing = db.query(Follow).filter(
        Follow.follower_id == current_user.id,
        Follow.following_id == user_id
    ).first()

    if existing:
        raise HTTPException(status_code=400, detail="Already following")

    new_follow = Follow(
        id=str(uuid.uuid4()),
        follower_id=current_user.id,
        following_id=user_id
    )

    db.add(new_follow)
    db.commit()

    return {"message": "Followed successfully"}


@app.delete("/unfollow/{user_id}")
def unfollow_user(
    user_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    follow = db.query(Follow).filter(
        Follow.follower_id == current_user.id,
        Follow.following_id == user_id
    ).first()

    if not follow:
        raise HTTPException(status_code=404, detail="Not following")

    db.delete(follow)
    db.commit()

    return {"message": "Unfollowed successfully"}


# ── FOLLOWERS / FOLLOWING ─────────────────────────────────

@app.get("/users/{user_id}/followers")
def get_followers(user_id: str, db: Session = Depends(get_db)):
    followers = db.query(Follow).filter(Follow.following_id == user_id).all()
    return [{"follower_id": f.follower_id, "following_id": f.following_id} for f in followers]


@app.get("/users/{user_id}/following")
def get_following(user_id: str, db: Session = Depends(get_db)):
    following = db.query(Follow).filter(Follow.follower_id == user_id).all()
    return [{"follower_id": f.follower_id, "following_id": f.following_id} for f in following]


# ── POSTS ─────────────────────────────────────────────────

@app.get("/users/{user_id}/posts")
def get_user_posts(user_id: str, db: Session = Depends(get_db)):
    posts = db.query(Post).filter(Post.author_id == user_id).all()
    return posts