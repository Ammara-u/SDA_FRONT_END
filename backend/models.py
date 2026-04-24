from sqlalchemy import Column, String, Integer, DateTime, Text, ForeignKey
from sqlalchemy.sql import func
from database import Base

class User(Base):
    __tablename__ = "users"

    id = Column(String, primary_key=True)
    username = Column(String, unique=True, index=True)
    email = Column(String, unique=True)
    password = Column(String)
    full_name = Column(String)
    created_at = Column(DateTime, server_default=func.now())
    department=Column(String)
    university=Column(String)
    bio=Column(String) 
    
from sqlalchemy import UniqueConstraint

class Follow(Base):
    __tablename__ = "follows"

    id = Column(String, primary_key=True)
    follower_id = Column(String, ForeignKey("users.id"))
    following_id = Column(String, ForeignKey("users.id"))

    __table_args__ = (
        UniqueConstraint("follower_id", "following_id"),
    )
    
class Post(Base):
    __tablename__ = "posts"

    id = Column(String, primary_key=True)
    author_id = Column(String, ForeignKey("users.id"))
    content = Column(Text)
    created_at = Column(DateTime, server_default=func.now())

class Comment(Base):
    __tablename__ = "comments"

    id = Column(String, primary_key=True)
    post_id = Column(String, ForeignKey("posts.id"))
    author_id = Column(String, ForeignKey("users.id"))
    parent_id = Column(String, ForeignKey("comments.id"), nullable=True)

    content = Column(Text)
    created_at = Column(DateTime, server_default=func.now())

class Notification(Base):
    __tablename__ = "notifications"

    id = Column(String, primary_key=True)
    user_id = Column(String, ForeignKey("users.id"))

    type = Column(String)  # like, comment, follow
    entity_type = Column(String, nullable=True)
    entity_id = Column(String, nullable=True)

    is_read = Column(Integer, default=0)
    created_at = Column(DateTime, server_default=func.now())

class Group(Base):
    __tablename__ = "groups"

    id = Column(String, primary_key=True)
    name = Column(String)
    description = Column(Text, nullable=True)
    is_private = Column(Integer, default=0)

    created_by = Column(String, ForeignKey("users.id"))
    university = Column(String, nullable=True)

    created_at = Column(DateTime, server_default=func.now())

class GroupMember(Base):
    __tablename__ = "group_members"

    id = Column(String, primary_key=True)
    group_id = Column(String, ForeignKey("groups.id"))
    user_id = Column(String, ForeignKey("users.id"))

    role = Column(String, default="member")  # admin/member


class Conversation(Base):
    __tablename__ = "conversations"

    id = Column(String, primary_key=True)
    created_at = Column(DateTime, server_default=func.now())

class ConversationParticipant(Base):
    __tablename__ = "conversation_participants"

    id = Column(String, primary_key=True)
    conversation_id = Column(String, ForeignKey("conversations.id"))
    user_id = Column(String, ForeignKey("users.id"))

class Message(Base):
    __tablename__ = "messages"

    id = Column(String, primary_key=True)
    conversation_id = Column(String, ForeignKey("conversations.id"))
    sender_id = Column(String, ForeignKey("users.id"))

    content = Column(Text, nullable=True)
    created_at = Column(DateTime, server_default=func.now())

