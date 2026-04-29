"""Configuration management for OpenHands client."""

import os
from dataclasses import dataclass, field
from enum import Enum
from typing import Optional
from pydantic import BaseModel, SecretStr


class WorkspaceType(str, Enum):
    """Supported workspace types."""
    LOCAL = "local"
    DOCKER = "docker"
    REMOTE = "remote"
    API_REMOTE = "api_remote"
    CLOUD = "cloud"


class SecurityPolicy(str, Enum):
    """Security policy options."""
    ALWAYS_CONFIRM = "always_confirm"
    NEVER_CONFIRM = "never_confirm"
    CONFIRM_RISKY = "confirm_risky"


class LLMConfig(BaseModel):
    """LLM configuration settings."""
    model: str = "anthropic/claude-sonnet-4-5-20250929"
    api_key: Optional[SecretStr] = None
    base_url: Optional[str] = None
    
    @classmethod
    def from_env(cls) -> "LLMConfig":
        """Create LLM config from environment variables."""
        return cls(
            model=os.getenv("LLM_MODEL", "anthropic/claude-sonnet-4-5-20250929"),
            api_key=SecretStr(os.getenv("LLM_API_KEY", "")) if os.getenv("LLM_API_KEY") else None,
            base_url=os.getenv("LLM_BASE_URL"),
        )


class WorkspaceConfig(BaseModel):
    """Workspace configuration settings."""
    workspace_type: WorkspaceType = WorkspaceType.LOCAL
    working_dir: str = "/workspace"
    # For remote workspaces
    host: Optional[str] = None
    api_key: Optional[SecretStr] = None
    # For API Remote workspace
    runtime_api_url: Optional[str] = None
    runtime_api_key: Optional[SecretStr] = None
    server_image: Optional[str] = "ghcr.io/openhands/agent-server:latest-python"
    # For Cloud workspace
    cloud_api_url: Optional[str] = "https://app.all-hands.dev"
    cloud_api_key: Optional[SecretStr] = None


class ClientConfig(BaseModel):
    """Main client configuration."""
    llm: LLMConfig = field(default_factory=LLMConfig)
    workspace: WorkspaceConfig = field(default_factory=WorkspaceConfig)
    security_policy: SecurityPolicy = SecurityPolicy.CONFIRM_RISKY
    persistence_dir: str = "./conversations"
    enable_browser_tools: bool = False
    enable_metrics: bool = True
    max_context_size: int = 50  # For condenser
    
    class Config:
        use_enum_values = True
    
    @classmethod
    def from_env(cls) -> "ClientConfig":
        """Create configuration from environment variables."""
        return cls(
            llm=LLMConfig.from_env(),
            workspace=WorkspaceConfig(
                workspace_type=WorkspaceType(os.getenv("WORKSPACE_TYPE", "local")),
                working_dir=os.getenv("WORKSPACE_DIR", "/workspace"),
                host=os.getenv("REMOTE_HOST"),
                api_key=SecretStr(os.getenv("REMOTE_API_KEY", "")) if os.getenv("REMOTE_API_KEY") else None,
                cloud_api_url=os.getenv("OPENHANDS_CLOUD_URL", "https://app.all-hands.dev"),
                cloud_api_key=SecretStr(os.getenv("OPENHANDS_CLOUD_API_KEY", "")) if os.getenv("OPENHANDS_CLOUD_API_KEY") else None,
            ),
            security_policy=SecurityPolicy(os.getenv("SECURITY_POLICY", "confirm_risky")),
            persistence_dir=os.getenv("PERSISTENCE_DIR", "./conversations"),
            enable_browser_tools=os.getenv("ENABLE_BROWSER", "false").lower() == "true",
            enable_metrics=os.getenv("ENABLE_METRICS", "true").lower() == "true",
            max_context_size=int(os.getenv("MAX_CONTEXT_SIZE", "50")),
        )
    
    def to_dict(self) -> dict:
        """Convert to dictionary (hiding secrets)."""
        return {
            "llm": {
                "model": self.llm.model,
                "base_url": self.llm.base_url,
                "has_api_key": self.llm.api_key is not None,
            },
            "workspace": {
                "type": self.workspace.workspace_type.value if isinstance(self.workspace.workspace_type, WorkspaceType) else self.workspace.workspace_type,
                "working_dir": self.workspace.working_dir,
                "host": self.workspace.host,
            },
            "security_policy": self.security_policy.value if isinstance(self.security_policy, SecurityPolicy) else self.security_policy,
            "persistence_dir": self.persistence_dir,
            "enable_browser_tools": self.enable_browser_tools,
            "enable_metrics": self.enable_metrics,
            "max_context_size": self.max_context_size,
        }
