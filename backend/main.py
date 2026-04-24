from fastapi import FastAPI, HTTPException, Depends
from fastapi.security import OAuth2PasswordBearer, OAuth2PasswordRequestForm
from sqlalchemy.orm import Session
from passlib.context import CryptContext
from jose import JWTError, jwt
from datetime import datetime, timedelta
from database import get_db
from models import User
from schema import TokenPair,UserCreate
from database import engine,Base,SessionLocal
import uuid

app = FastAPI()

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
    except JWTError:
        return None


# def create_access_token(user_id: int):
#     expire = datetime.utcnow() + timedelta(minutes=15)  # short lived
#     return jwt.encode(
#         {"sub": str(user_id), "exp": expire, "type": "access"},
#         SECRET_KEY, algorithm=ALGORITHM
#     )
    
# def create_refresh_token(user_id: int):
#     expire = datetime.utcnow() + timedelta(days=30)  # long lived
#     return jwt.encode(
#         {"sub": str(user_id), "exp": expire, "type": "refresh"},
#         SECRET_KEY, algorithm=ALGORITHM
#     )
Base.metadata.create_all(bind=engine)




# sign up

import uuid # Add this import at the top

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
def login(user: UserCreate, db: Session = Depends(get_db)):
    # 1. Fetch user from DB
    db_user = db.query(User).filter(User.username == user.username).first()

    # 2. Check if user exists and verify password
    # Note: verify_password(plain_text, hashed_from_db)
    if not db_user or not verify_password(user.password, db_user.password):
        raise HTTPException(status_code=401, detail="Invalid username or password")

    # 3. Create both tokens (Frontend expects both per your TokenPair schema)
    access_token = create_access_token(data={"sub": db_user.username})
    
    # Simple refresh token for now (you can use your commented-out function later)
    refresh_token = create_access_token(
        data={"sub": db_user.username}, 
        expires_delta=timedelta(days=7)
    )

    # 4. Return matching the TokenPair Schema exactly
    return {
        "access_token": access_token,
        "refresh_token": refresh_token,
        "token_type": "bearer"
    }
