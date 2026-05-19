import React, { useEffect, useState } from "react";
import { getUsers, deleteUser, getMetrics } from "../utils/api";

export default function UsersPage() {
  const [users, setUsers] = useState([]);
  const [metrics, setMetrics] = useState(null);
  const [loading, setLoading] = useState(true);
  const [deleting, setDeleting] = useState(null);
  const [message, setMessage] = useState(null);

  const load = async () => {
    setLoading(true);
    try {
      const [usersRes, metricsRes] = await Promise.all([getUsers(), getMetrics()]);
      setUsers(usersRes.data.users || []);
      setMetrics(metricsRes.data);
    } catch {
      setMessage({ type: "error", text: "Error al cargar datos" });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const handleDelete = async (name) => {
    if (!window.confirm(`¿Eliminar a "${name}" de la base de datos?`)) return;
    setDeleting(name);
    try {
      await deleteUser(name);
      setMessage({ type: "success", text: `"${name}" eliminado` });
      setUsers((prev) => prev.filter((u) => u.name !== name));
    } catch (err) {
      setMessage({ type: "error", text: err?.response?.data?.detail || "Error al eliminar" });
    } finally {
      setDeleting(null);
    }
  };

  return (
    <div>
      <div className="page-header">
        <h1 className="page-title">Base de datos</h1>
        <p className="page-subtitle">Usuarios registrados y métricas del sistema</p>
      </div>

      {message && (
        <div className={`alert alert-${message.type}`}>
          {message.text}
          <button onClick={() => setMessage(null)}
            style={{ float: "right", background: "none", border: "none", cursor: "pointer", color: "inherit" }}>✕</button>
        </div>
      )}

      {/* Métricas */}
      {metrics && (
        <div className="card">
          <div className="card-title">Configuración del sistema</div>
          <div className="metrics-grid">
            <div className="metric-item">
              <div className="metric-label">Modelo de embedding</div>
              <div className="metric-value" style={{ fontSize: "0.9rem" }}>{metrics.model}</div>
            </div>
            <div className="metric-item">
              <div className="metric-label">Detector</div>
              <div className="metric-value" style={{ fontSize: "0.9rem" }}>{metrics.detector}</div>
            </div>
            <div className="metric-item">
              <div className="metric-label">Dimensión embedding</div>
              <div className="metric-value">{metrics.embedding_dim}</div>
            </div>
            <div className="metric-item">
              <div className="metric-label">Umbral similitud</div>
              <div className="metric-value">{metrics.threshold}</div>
            </div>
            <div className="metric-item">
              <div className="metric-label">Métrica</div>
              <div className="metric-value" style={{ fontSize: "0.75rem" }}>{metrics.distance_metric}</div>
            </div>
            <div className="metric-item">
              <div className="metric-label">Usuarios registrados</div>
              <div className="metric-value">{metrics.registered_users}</div>
            </div>
          </div>
        </div>
      )}

      {/* Lista de usuarios */}
      <div className="card">
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1rem" }}>
          <div className="card-title" style={{ marginBottom: 0 }}>
            Usuarios ({users.length})
          </div>
          <button className="btn btn-ghost btn-sm" onClick={load} disabled={loading}>
            {loading ? <span className="spinner" style={{ width: 14, height: 14 }} /> : "↻ Actualizar"}
          </button>
        </div>

        {loading && <p style={{ color: "var(--text-dim)" }}>Cargando…</p>}

        {!loading && users.length === 0 && (
          <p style={{ color: "var(--text-dim)", fontSize: "0.9rem" }}>
            No hay usuarios registrados. Ve a <strong>Registrar</strong> para agregar personas.
          </p>
        )}

        {!loading && users.length > 0 && (
          <div className="user-grid">
            {users.map((u) => (
              <div key={u.name} className="user-card">
                <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                  <div style={{
                    width: 36, height: 36, borderRadius: "50%",
                    background: "var(--accent)", opacity: 0.8,
                    display: "flex", alignItems: "center", justifyContent: "center",
                    fontWeight: 700, fontSize: "0.9rem", color: "#fff", flexShrink: 0,
                  }}>
                    {u.name.charAt(0).toUpperCase()}
                  </div>
                  <div className="user-card-name">{u.name}</div>
                </div>
                <div className="user-card-meta">
                  {u.n_images} embedding{u.n_images !== 1 ? "s" : ""}
                </div>
                <div className="user-card-meta">
                  {u.registered_at}
                </div>
                <button
                  className="btn btn-danger btn-sm"
                  onClick={() => handleDelete(u.name)}
                  disabled={deleting === u.name}
                  style={{ marginTop: 6, alignSelf: "flex-start" }}
                >
                  {deleting === u.name ? <span className="spinner" style={{ width: 12, height: 12 }} /> : "Eliminar"}
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
