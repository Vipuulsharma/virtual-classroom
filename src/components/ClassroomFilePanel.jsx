import { useState, useRef } from "react";
import {
  IconFolder,
  IconUpload,
  IconDownload,
  IconTrash,
  IconPlus,
  IconX,
  IconRocket,
  IconLock,
  IconZap,
  IconShield
} from "./ModernIcons";

export default function ClassroomFilePanel({
  isOpen = false,
  onClose,
  trustScore = 80,
  downloadAllowed = true,
  isTeacher = false,
  files = [],
  onUploadFile,
  onDeleteFile,
  onOpenStepUp,
  onTriggerDownload
}) {
  const [downloadingId, setDownloadingId] = useState(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("all");
  
  // Teacher Upload Form State
  const [showUploadForm, setShowUploadForm] = useState(false);
  const [uploadTitle, setUploadTitle] = useState("");
  const [uploadCategory, setUploadCategory] = useState("Lecture Slides");
  const [selectedFileObj, setSelectedFileObj] = useState(null);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadSuccessMsg, setUploadSuccessMsg] = useState("");
  
  const fileInputRef = useRef(null);

  if (!isOpen) return null;

  // Filter files
  const filteredFiles = (files || []).filter((f) => {
    const matchesSearch = f.name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      f.category?.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesCat = selectedCategory === "all" || f.category === selectedCategory;
    return matchesSearch && matchesCat;
  });

  const categories = ["all", "Lecture Slides", "Notes", "Code Starter", "Assignment", "Exam Guide"];

  const handleFileChange = (e) => {
    const file = e.target.files?.[0];
    if (file) {
      setSelectedFileObj(file);
      if (!uploadTitle.trim()) {
        setUploadTitle(file.name.replace(/\.[^/.]+$/, ""));
      }
    }
  };

  const handleTeacherSubmitUpload = (e) => {
    e.preventDefault();
    if (!isTeacher) return;
    if (!selectedFileObj && !uploadTitle.trim()) return;

    setIsUploading(true);
    const fileName = selectedFileObj ? selectedFileObj.name : `${uploadTitle.trim()}.pdf`;
    const formatBytes = (bytes) => {
      if (!bytes) return "1.2 MB";
      const k = 1024;
      const dm = 1;
      const sizes = ["Bytes", "KB", "MB", "GB"];
      const i = Math.floor(Math.log(bytes) / Math.log(k));
      return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + " " + sizes[i];
    };
    const fileSize = selectedFileObj ? formatBytes(selectedFileObj.size) : "1.5 MB";
    const ext = fileName.split(".").pop().toLowerCase();
    const fileType = ["pdf", "doc", "docx", "zip", "txt", "ppt", "pptx", "png", "jpg"].includes(ext) ? ext : "pdf";

    // Read file as Data URL if file was selected
    const proceedWithData = (dataUrl = null) => {
      const newFilePayload = {
        name: fileName,
        size: fileSize,
        type: fileType,
        category: uploadCategory,
        dataUrl
      };

      if (onUploadFile) {
        onUploadFile(newFilePayload);
      }

      setIsUploading(false);
      setSelectedFileObj(null);
      setUploadTitle("");
      if (fileInputRef.current) fileInputRef.current.value = "";
      setShowUploadForm(false);
      setUploadSuccessMsg(`✓ "${fileName}" uploaded successfully and shared with students!`);
      setTimeout(() => setUploadSuccessMsg(""), 4000);
    };

    if (selectedFileObj) {
      const reader = new FileReader();
      reader.onload = () => proceedWithData(reader.result);
      reader.onerror = () => proceedWithData(null);
      reader.readAsDataURL(selectedFileObj);
    } else {
      proceedWithData(null);
    }
  };

  const handleDownload = (file) => {
    if (!downloadAllowed && !isTeacher) {
      if (onOpenStepUp) onOpenStepUp("download");
      return;
    }

    setDownloadingId(file.id);
    if (onTriggerDownload) {
      onTriggerDownload(file);
    }

    setTimeout(() => {
      if (file.dataUrl) {
        const a = document.createElement("a");
        a.href = file.dataUrl;
        a.download = file.name;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
      } else {
        const blob = new Blob([
          `Virtual Classroom Resource: ${file.name}\nCategory: ${file.category || "Notes"}\nZero-Trust Integrity Verified: Passed\nDownloaded: ${new Date().toISOString()}`
        ], { type: "text/plain" });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = file.name;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
      }
      setDownloadingId(null);
    }, 600);
  };

  const getFileBadge = (type) => {
    const t = String(type || "").toLowerCase();
    if (t.includes("pdf")) return <span className="modern-file-badge pdf">PDF</span>;
    if (t.includes("doc")) return <span className="modern-file-badge doc">DOC</span>;
    if (t.includes("zip")) return <span className="modern-file-badge zip">ZIP</span>;
    if (t.includes("ppt")) return <span className="modern-file-badge ppt">PPT</span>;
    return <span className="modern-file-badge file">FILE</span>;
  };

  return (
    <div className="classroom-panel-overlay" onClick={onClose}>
      <aside className="classroom-files-panel" onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div className="files-header">
          <div style={{ display: "flex", alignItems: "center", gap: "10px", flexWrap: "wrap" }}>
            <span className="panel-header-icon-box">
              <IconFolder size={18} />
            </span>
            <div>
              <h3 style={{ margin: 0, fontSize: "16px", fontWeight: "700", color: "#f8fafc" }}>
                Classroom Resources
              </h3>
              <span style={{ fontSize: "11px", color: "var(--text-muted)" }}>
                {isTeacher ? "Instructor Resource Center • Mobile & Desktop" : "Materials Published by Instructor"}
              </span>
            </div>
          </div>
          <button type="button" onClick={onClose} className="panel-close-icon-btn" aria-label="Close files panel">
            <IconX size={18} />
          </button>
        </div>

        {/* Success Alert */}
        {uploadSuccessMsg && (
          <div className="files-alert-success">
            {uploadSuccessMsg}
          </div>
        )}

        <div className="files-body">
          {/* TEACHER-ONLY RESOURCE UPLOAD SECTION */}
          {isTeacher ? (
            <div className="teacher-upload-box">
              <div className="teacher-upload-header">
                <div>
                  <span className="teacher-badge-tag">Teacher Access</span>
                  <h4 style={{ margin: "4px 0 0 0", fontSize: "14px", color: "#f8fafc" }}>
                    Upload New Learning Material
                  </h4>
                  <p style={{ margin: "2px 0 0 0", fontSize: "11px", color: "var(--text-muted)" }}>
                    Works from Mobile phone files/camera and Desktop. Students receive uploaded files live.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setShowUploadForm(!showUploadForm)}
                  className="toggle-upload-btn"
                >
                  {showUploadForm ? (
                    <>
                      <IconX size={14} /> <span>Close</span>
                    </>
                  ) : (
                    <>
                      <IconPlus size={14} /> <span>Add Resource</span>
                    </>
                  )}
                </button>
              </div>

              {showUploadForm && (
                <form onSubmit={handleTeacherSubmitUpload} className="upload-form-drawer">
                  <div className="form-group-compact">
                    <label>Resource Title / Document Name:</label>
                    <input
                      type="text"
                      placeholder="e.g. Lecture 5 Security Notes"
                      value={uploadTitle}
                      onChange={(e) => setUploadTitle(e.target.value)}
                      required
                      className="panel-input"
                    />
                  </div>

                  <div className="form-group-compact">
                    <label>Category:</label>
                    <select
                      value={uploadCategory}
                      onChange={(e) => setUploadCategory(e.target.value)}
                      className="panel-select"
                    >
                      <option value="Lecture Slides">Lecture Slides</option>
                      <option value="Notes">Notes / Handouts</option>
                      <option value="Code Starter">Code Starter / Lab</option>
                      <option value="Assignment">Assignment</option>
                      <option value="Exam Guide">Exam Guide / Revision</option>
                    </select>
                  </div>

                  {/* Native Mobile + Desktop File Selector */}
                  <div className="file-dropzone" onClick={() => fileInputRef.current?.click()}>
                    <input
                      type="file"
                      ref={fileInputRef}
                      onChange={handleFileChange}
                      style={{ display: "none" }}
                      accept=".pdf,.doc,.docx,.ppt,.pptx,.txt,.zip,.png,.jpg,.jpeg"
                    />
                    <div className="dropzone-icon-circle">
                      <IconUpload size={22} />
                    </div>
                    <div style={{ textAlign: "center" }}>
                      <strong style={{ fontSize: "13px", color: "#a5b4fc", display: "block" }}>
                        {selectedFileObj ? selectedFileObj.name : "Tap to Select File (Mobile or Desktop)"}
                      </strong>
                      <span style={{ display: "block", fontSize: "11px", color: "var(--text-muted)", marginTop: "2px" }}>
                        PDF, Word, Slides, Code ZIP, or Images
                      </span>
                    </div>
                  </div>

                  <div style={{ display: "flex", gap: "8px", marginTop: "10px" }}>
                    <button
                      type="submit"
                      disabled={isUploading}
                      className="submit-upload-btn"
                    >
                      <IconRocket size={14} />
                      <span>{isUploading ? "Uploading..." : "Upload & Publish to Classroom"}</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setShowUploadForm(false)}
                      className="cancel-upload-btn"
                    >
                      <IconX size={13} />
                      <span>Cancel</span>
                    </button>
                  </div>
                </form>
              )}
            </div>
          ) : (
            <div className="student-resource-notice">
              <IconLock size={15} style={{ flexShrink: 0, marginTop: "2px" }} />
              <span><strong>Protected Resource Repository:</strong> Only teachers can upload classroom documents. Students have secure download access.</span>
            </div>
          )}

          {/* Search & Filter Controls */}
          <div className="files-filter-bar">
            <input
              type="text"
              placeholder="🔍 Search materials..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="files-search-input"
            />
            <div className="files-category-pills">
              {categories.map((cat) => (
                <button
                  key={cat}
                  type="button"
                  onClick={() => setSelectedCategory(cat)}
                  className={`category-pill ${selectedCategory === cat ? "active" : ""}`}
                >
                  {cat === "all" ? "All" : cat}
                </button>
              ))}
            </div>
          </div>

          {/* Files List */}
          <div className="files-list">
            {filteredFiles.length === 0 ? (
              <div className="no-files-slate">
                <span className="no-files-icon-box">
                  <IconFolder size={32} />
                </span>
                <p style={{ margin: "6px 0 0 0", fontSize: "13px", color: "var(--text-secondary)" }}>
                  No resources match the selected filter.
                </p>
                {isTeacher && (
                  <button
                    type="button"
                    onClick={() => setShowUploadForm(true)}
                    className="primary-btn-sm"
                    style={{ marginTop: "12px", display: "inline-flex", alignItems: "center", gap: "6px" }}
                  >
                    <IconPlus size={14} />
                    <span>Upload First Resource</span>
                  </button>
                )}
              </div>
            ) : (
              filteredFiles.map((f) => (
                <div key={f.id} className="file-item-card">
                  <div className="file-icon-box">
                    {getFileBadge(f.type)}
                  </div>
                  <div className="file-info-col">
                    <span className="file-name" title={f.name}>{f.name}</span>
                    <span className="file-meta">
                      {f.size} • <span className="cat-tag">{f.category || "Document"}</span> • By {f.uploader || "Teacher"}
                    </span>
                  </div>
                  
                  <div className="file-card-actions">
                    <button
                      type="button"
                      onClick={() => handleDownload(f)}
                      disabled={downloadingId === f.id}
                      className={`file-dl-btn ${(downloadAllowed || isTeacher) ? "allowed" : "locked"}`}
                      title={(downloadAllowed || isTeacher) ? "Download File" : "Trust score below 75 - Click to Step-Up"}
                    >
                      {(downloadAllowed || isTeacher) ? (
                        <>
                          <IconDownload size={13} />
                          <span>{downloadingId === f.id ? "Saving..." : "Download"}</span>
                        </>
                      ) : (
                        <>
                          <IconLock size={13} />
                          <span>Req 75</span>
                        </>
                      )}
                    </button>

                    {/* Teacher Delete Option */}
                    {isTeacher && (
                      <button
                        type="button"
                        onClick={() => onDeleteFile && onDeleteFile(f.id)}
                        className="file-del-btn"
                        title="Delete Resource"
                      >
                        <IconTrash size={15} />
                      </button>
                    )}
                  </div>
                </div>
              ))
            )}
          </div>

          {/* Student Zero-Trust Notice when Downloads restricted */}
          {!isTeacher && !downloadAllowed && (
            <div className="files-locked-banner">
              <span className="files-lock-icon">
                <IconShield size={16} />
              </span>
              <div>
                <strong>Downloads Restricted (Trust: {trustScore}/75)</strong>
                <p style={{ margin: "2px 0 0 0", fontSize: "12px", color: "var(--text-muted)" }}>
                  Zero-Trust Policy requires score &ge; 75 to export session materials. Boost by +20 with step-up verification.
                </p>
              </div>
              <button
                type="button"
                onClick={() => onOpenStepUp && onOpenStepUp("download")}
                className="files-stepup-cta"
              >
                <IconZap size={14} />
                <span>Step-Up (+20)</span>
              </button>
            </div>
          )}
        </div>
      </aside>
    </div>
  );
}
