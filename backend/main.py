from fastapi import FastAPI, HTTPException, Depends
from fastapi.security import OAuth2PasswordBearer, OAuth2PasswordRequestForm
from sqlalchemy.orm import Session
from passlib.context import CryptContext
from jose import JWTError, jwt
from datetime import datetime, timedelta
from database import get_db
from models import User,Follow,Post
from schema import TokenPair,UserCreate,UserLogin
from database import engine,Base,SessionLocal
import uuid
from fastapi.middleware.cors import CORSMiddleware

app = FastAPI()


app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # for development
    allow_credentials=True,
    allow_methods=["*"],  # IMPORTANT (allows OPTIONS)
    allow_headers=["*"],
)

# --- Config ---
SECRET_KEY = "fbab35ec4019c91b7d06cd19a0e7290ca81d7b6bed0ea43e1fdcfa7128e7c1f2"
ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_MINUTES=30

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")

import bcrypt

def hash_password(password: str):
    # Convert string to bytes
    pwd_bytes = password.encode('utf-8')
    # Generate salt and hash
    salt = bcrypt.gensalt()
    hashed_password = bcrypt.hashpw(pwd_bytes, salt)
    # Return as string to store in DB
    return hashed_password.decode('utf-8')

def verify_password(plain_password: str, hashed_password: str):
    password_byte_enc = plain_password.encode('utf-8')
    hashed_password_byte_enc = hashed_password.encode('utf-8')
    return bcrypt.checkpw(password_byte_enc, hashed_password_byte_enc)

def create_access_token(data:dict,expires_delta:timedelta=None):
    to_encode=data.copy()
    expire=datetime.utcnow()+(expires_delta if expires_delta else timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES))
    to_encode.update({"exp":expire})
    encoded_jwt=jwt.encode(to_encode,SECRET_KEY,algorithm=ALGORITHM)
    return encoded_jwt

def decode_access_token(token:str):
    try:
        payload=jwt.decode(token,SECRET_KEY,algorithms=[ALGORITHM])
        return payload
    except JWTError:
        return None

Base.metadata.create_all(bind=engine)

oauth2_scheme = OAuth2PasswordBearer(tokenUrl="login")


def get_current_user(token: str = Depends(oauth2_scheme), db: Session = Depends(get_db)):
    payload = decode_access_token(token)
    if payload is None:
        raise HTTPException(status_code=401, detail="Invalid token")

    user_id = payload.get("sub")   # now it's ID

    user = db.query(User).filter(User.id == user_id).first()

    if not user:
        raise HTTPException(status_code=401, detail="User not found")

    return user
# sign up

@app.post("/signup")
def signup(user: UserCreate, db: Session = Depends(get_db)):
    # 1. Check if user exists
    existing = db.query(User).filter(User.username == user.username).first()
    if existing:
        raise HTTPException(status_code=400, detail="User already exists")
    
    # 2. Hash and create
    hashed_password = hash_password(user.password)
    new_user = User(
        id=str(uuid.uuid4()),  # Generate the missing ID
        username=user.username, 
        email=user.email,
        password=hashed_password, # Ensure this matches your Model column name
        full_name=user.full_name
    )
    
    try:
        db.add(new_user)
        db.commit()
        db.refresh(new_user)
    except Exception as e:
        db.rollback()
        print(f"Database Error: {e}") # This will show up in your terminal
        raise HTTPException(status_code=500, detail="Database insertion failed")
        
    return {"message": "User created successfully"}


@app.post("/login", response_model=TokenPair)
def login(user: UserLogin, db: Session = Depends(get_db)):    # 1. Fetch user from DB
    db_user = db.query(User).filter(User.username == user.username).first()

    # 2. Check if user exists and verify password
    # Note: verify_password(plain_text, hashed_from_db)
    if not db_user or not verify_password(user.password, db_user.password):
        raise HTTPException(status_code=401, detail="Invalid username or password")

    # 3. Create both tokens (Frontend expects both per your TokenPair schema)
    access_token = create_access_token(data={"sub": db_user.id})
    
    # Simple refresh token for now (you can use your commented-out function later)
    refresh_token = create_access_token(
        data={"sub": db_user.id}, 
        expires_delta=timedelta(days=7)
    )

    # 4. Return matching the TokenPair Schema exactly
    return {
        "access_token": access_token,
        "refresh_token": refresh_token,
        "token_type": "bearer"
    }

@app.post("/refresh", response_model=TokenPair)
def refresh_token(refresh_token: str, db: Session = Depends(get_db)):
    try:
        # 1. Decode the token
        payload = jwt.decode(refresh_token, SECRET_KEY, algorithms=[ALGORITHM])
        username: str = payload.get("sub")
        if username is None:
            raise HTTPException(status_code=401, detail="Invalid refresh token")
    except JWTError:
        raise HTTPException(status_code=401, detail="Refresh token expired")

    # 2. Verify user still exists in DB
    user = db.query(User).filter(User.username == username).first()
    if not user:
        raise HTTPException(status_code=401, detail="User not found")

    # 3. Generate a NEW access token
    new_access_token = create_access_token(data={"sub": user.id})
    
    # 4. Return everything (keep the same refresh token or rotate it)
    return {
        "access_token": new_access_token,
        "refresh_token": refresh_token, # You can reuse the current one
        "token_type": "bearer"
    }
    
    
@app.post("/follow/{user_id}")
def follow_user(user_id: str,
                db: Session = Depends(get_db),
                current_user: User = Depends(get_current_user)):

    #  Prevent self-follow
    if current_user.id == user_id:
        raise HTTPException(status_code=400, detail="You cannot follow yourself")

    #  Check if already following
    existing = db.query(Follow).filter(
        Follow.follower_id == current_user.id,
        Follow.following_id == user_id
    ).first()

    if existing:
        raise HTTPException(status_code=400, detail="Already following")

    # ✅ Create follow relationship
    new_follow = Follow(
        id=str(uuid.uuid4()),
        follower_id=current_user.id,
        following_id=user_id
    )

    db.add(new_follow)
    db.commit()

    return {"message": "Followed successfully"}


@app.delete("/unfollow/{user_id}")
def unfollow_user(user_id: str,
                  db: Session = Depends(get_db),
                  current_user: User = Depends(get_current_user)):

    follow = db.query(Follow).filter(
        Follow.follower_id == current_user.id,
        Follow.following_id == user_id
    ).first()

    if not follow:
        raise HTTPException(status_code=404, detail="Not following")

    db.delete(follow)
    db.commit()

    return {"message": "Unfollowed successfully"}

@app.get("/users/id/{user_id}")
def get_user_by_id(user_id: str, db: Session = Depends(get_db)):
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    return user

@app.get("/users/{user_id}/followers")
def get_followers(user_id: str, db: Session = Depends(get_db)):
    followers = db.query(Follow).filter(Follow.following_id == user_id).all()
    return [{"follower_id": f.follower_id, "following_id": f.following_id} for f in followers]


@app.get("/users/{user_id}/following")
def get_following(user_id: str, db: Session = Depends(get_db)):
    following = db.query(Follow).filter(Follow.follower_id == user_id).all()
    return [{"follower_id": f.follower_id, "following_id": f.following_id} for f in following]

@app.get("/users/{user_id}/posts")
def get_user_posts(user_id: str, db: Session = Depends(get_db)):
    posts = db.query(Post).filter(Post.author_id == user_id).all()
    return posts