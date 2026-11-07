use std::collections::BTreeMap;

use serde::{Deserialize, Serialize};

pub const WEBASSEMBLY_PROFILE: &str =
    include_str!("../../../data/standards/web/webassembly/webassembly.current.json");
pub const MDN_COMPAT_PROFILE: &str =
    include_str!("../../../data/standards/web/mdn/mdn-compat.current.json");
pub const TC39_PROFILE: &str = include_str!("../../../data/standards/web/tc39/tc39.current.json");
pub const MCP_PROFILE: &str =
    include_str!("../../../data/standards/web/mcp/mcp-2026.current.json");

#[derive(Debug, thiserror::Error)]
pub enum StandardError {
    #[error("invalid standard JSON: {0}")]
    Json(#[from] serde_json::Error),
    #[error("standard validation failed: {0}")]
    Validation(String),
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct WebAssemblySpec {
    pub version: String,
    pub core_spec_url: String,
    pub component_model_spec_url: String,
    pub val_types: Vec<String>,
    pub component_types: Vec<String>,
    pub sections: Vec<WasmSection>,
    #[serde(default)]
    pub canonical_abis: Vec<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct WasmSection {
    pub id: u8,
    pub name: String,
    pub description: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct MdnCompatSchema {
    pub feature: String,
    #[serde(default)]
    pub mdn_url: Option<String>,
    pub support: BTreeMap<String, BrowserSupport>,
    #[serde(default)]
    pub subfeatures: BTreeMap<String, serde_json::Value>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct BrowserSupport {
    #[serde(default)]
    pub version_added: Option<VersionState>,
    #[serde(default)]
    pub version_removed: Option<VersionState>,
    #[serde(default)]
    pub prefix: Option<String>,
    #[serde(default)]
    pub notes: Option<SupportNotes>,
    #[serde(flatten)]
    pub additional: BTreeMap<String, serde_json::Value>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(untagged)]
pub enum VersionState {
    Version(String),
    Boolean(bool),
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(untagged)]
pub enum SupportNotes {
    One(String),
    Many(Vec<String>),
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Tc39ProposalsSchema {
    pub proposals: Vec<Tc39Proposal>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Tc39Proposal {
    pub name: String,
    pub stage: u8,
    pub champions: Vec<String>,
    pub url: String,
    #[serde(default)]
    pub tags: Vec<String>,
    #[serde(default)]
    pub notes: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct McpSpec2026 {
    pub version: String,
    pub protocol_version: String,
    pub transports: Vec<String>,
    pub capabilities: McpCapabilities,
    #[serde(default)]
    pub methods: Vec<McpMethod>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct McpCapabilities {
    pub server: McpServerCapabilities,
    pub client: McpClientCapabilities,
}

#[derive(Debug, Clone, Serialize, Deserialize, Default)]
pub struct McpServerCapabilities {
    #[serde(default)]
    pub tools: Option<bool>,
    #[serde(default)]
    pub resources: Option<bool>,
    #[serde(default)]
    pub prompts: Option<bool>,
    #[serde(default)]
    pub logging: Option<bool>,
    #[serde(default)]
    pub streaming: Option<bool>,
}

#[derive(Debug, Clone, Serialize, Deserialize, Default)]
pub struct McpClientCapabilities {
    #[serde(default)]
    pub roots: Option<bool>,
    #[serde(default)]
    pub sampling: Option<bool>,
    #[serde(default)]
    pub experimental: BTreeMap<String, serde_json::Value>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct McpMethod {
    pub name: String,
    pub kind: McpMethodKind,
    #[serde(default)]
    pub params_schema: Option<serde_json::Value>,
    #[serde(default)]
    pub result_schema: Option<serde_json::Value>,
}

#[derive(Debug, Clone, Copy, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum McpMethodKind {
    Request,
    Notification,
}

pub fn parse_webassembly_spec(json: &str) -> Result<WebAssemblySpec, StandardError> {
    let spec: WebAssemblySpec = serde_json::from_str(json)?;
    validate_webassembly(&spec)?;
    Ok(spec)
}

pub fn parse_mdn_compat(json: &str) -> Result<MdnCompatSchema, StandardError> {
    let spec: MdnCompatSchema = serde_json::from_str(json)?;
    if spec.feature.is_empty() || spec.support.is_empty() {
        return Err(StandardError::Validation("MDN feature and support matrix must be non-empty".into()));
    }
    Ok(spec)
}

pub fn parse_tc39_proposals(json: &str) -> Result<Tc39ProposalsSchema, StandardError> {
    let spec: Tc39ProposalsSchema = serde_json::from_str(json)?;
    if spec.proposals.iter().any(|proposal| proposal.stage > 4 || proposal.name.is_empty()) {
        return Err(StandardError::Validation("TC39 proposal stage must be 0 through 4 and name must be non-empty".into()));
    }
    Ok(spec)
}

pub fn parse_mcp_spec(json: &str) -> Result<McpSpec2026, StandardError> {
    let spec: McpSpec2026 = serde_json::from_str(json)?;
    if spec.version.is_empty() || spec.protocol_version.is_empty() {
        return Err(StandardError::Validation("MCP profile and protocol versions must be non-empty".into()));
    }
    Ok(spec)
}

pub fn embedded_webassembly_spec() -> Result<WebAssemblySpec, StandardError> {
    parse_webassembly_spec(WEBASSEMBLY_PROFILE)
}

pub fn embedded_mdn_compat() -> Result<MdnCompatSchema, StandardError> {
    parse_mdn_compat(MDN_COMPAT_PROFILE)
}

pub fn embedded_tc39_proposals() -> Result<Tc39ProposalsSchema, StandardError> {
    parse_tc39_proposals(TC39_PROFILE)
}

pub fn embedded_mcp_spec() -> Result<McpSpec2026, StandardError> {
    parse_mcp_spec(MCP_PROFILE)
}

fn validate_webassembly(spec: &WebAssemblySpec) -> Result<(), StandardError> {
    if spec.version.is_empty()
        || spec.core_spec_url.is_empty()
        || spec.component_model_spec_url.is_empty()
        || spec.sections.iter().any(|section| section.name.is_empty())
    {
        return Err(StandardError::Validation("WebAssembly metadata and section names must be non-empty".into()));
    }
    Ok(())
}
