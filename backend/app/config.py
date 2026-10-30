from pydantic_settings import BaseSettings

class Settings(BaseSettings):
    GITHUB_TOKEN: str = ""

    class Config:
        env_file = ".env"
        env_file_encoding = "utf-8"

# Load settings instance for use throughout the app
settings = Settings()
