import React, { useState } from "react";
import PageLayout from "../../components/PageLayout.jsx";
import { useAuth } from "../../auth/AuthContext.jsx";
import { updateProfile, changePassword } from "../../api";
import { validateProfile, validatePasswordChange } from "../../validation.js";
import { initials } from "../events/helpers.js";

export default function Profile() {
  const { user, updateUser } = useAuth();
  const [form, setForm] = useState({ name: user.name, phone: user.phone || "" });
  const [errs, setErrs] = useState({});
  const [msg, setMsg] = useState(null);
  const [saving, setSaving] = useState(false);

  const [pw, setPw] = useState({ current: "", next: "", confirm: "" });
  const [pwErrs, setPwErrs] = useState({});
  const [pwMsg, setPwMsg] = useState(null);
  const [pwSaving, setPwSaving] = useState(false);

  const dirty = form.name.trim() !== user.name || form.phone.trim() !== (user.phone || "");

  const saveProfile = async (e) => {
    e.preventDefault();
    setMsg(null);
    const v = validateProfile(form);
    setErrs(v);
    if (Object.keys(v).length) return;
    setSaving(true);
    try {
      const updated = await updateProfile(user.email, form);
      updateUser({ name: updated.name, phone: updated.phone });
      setMsg({ ok: true, text: "Profile updated." });
    } catch (err) {
      setMsg({ ok: false, text: err.message });
    } finally {
      setSaving(false);
    }
  };

  const savePassword = async (e) => {
    e.preventDefault();
    setPwMsg(null);
    const v = validatePasswordChange(pw);
    setPwErrs(v);
    if (Object.keys(v).length) return;
    setPwSaving(true);
    try {
      await changePassword(user.email, pw.current, pw.next);
      setPw({ current: "", next: "", confirm: "" });
      setPwMsg({ ok: true, text: "Password changed." });
    } catch (err) {
      setPwMsg({ ok: false, text: err.message });
    } finally {
      setPwSaving(false);
    }
  };

  const bind = (state, setState, name) => ({ name, value: state[name], onChange: (e) => setState((p) => ({ ...p, [name]: e.target.value })) });

  return (
    <PageLayout>
      <h1>My profile</h1>
      <p className="ws-sub">Update your details and password.</p>

      <div className="profile-grid">
        <form className="ev-form" onSubmit={saveProfile} noValidate>
          <div className="ev-row" style={{ justifyContent: "flex-start", gap: 14 }}>
            <div className="avatar-lg">{initials(form.name || user.name)}</div>
            <div><strong>{user.name}</strong><p className="ev-muted">{user.role}</p></div>
          </div>
          {msg && <p className={msg.ok ? "ev-ok" : "ev-error"} role="status">{msg.text}</p>}
          <label>Full name
            <input {...bind(form, setForm, "name")} maxLength={60} required aria-invalid={Boolean(errs.name)} autoComplete="name" />
            {errs.name && <small className="err">{errs.name}</small>}
          </label>
          <label>Email
            <input value={user.email} disabled readOnly />
            <small className="hint">Email is your login and cannot be changed.</small>
          </label>
          <label>Phone number
            <input type="tel" {...bind(form, setForm, "phone")} placeholder="+91 98765 43210" aria-invalid={Boolean(errs.phone)} autoComplete="tel" />
            {errs.phone && <small className="err">{errs.phone}</small>}
          </label>
          <label>Role
            <input value={user.role} disabled readOnly />
            <small className="hint">Only an administrator can change roles.</small>
          </label>
          <div className="ev-manage">
            <button className="ev-btn" type="submit" disabled={saving || !dirty}>{saving ? "Saving..." : "Save profile"}</button>
            <button className="ev-btn ghost" type="button" disabled={!dirty} onClick={() => { setForm({ name: user.name, phone: user.phone || "" }); setErrs({}); }}>Reset</button>
          </div>
        </form>

        <form className="ev-form" onSubmit={savePassword} noValidate>
          <h2>Change password</h2>
          {pwMsg && <p className={pwMsg.ok ? "ev-ok" : "ev-error"} role="status">{pwMsg.text}</p>}
          <label>Current password
            <input type="password" {...bind(pw, setPw, "current")} autoComplete="current-password" aria-invalid={Boolean(pwErrs.current)} />
            {pwErrs.current && <small className="err">{pwErrs.current}</small>}
          </label>
          <label>New password
            <input type="password" {...bind(pw, setPw, "next")} autoComplete="new-password" aria-invalid={Boolean(pwErrs.next)} />
            {pwErrs.next ? <small className="err">{pwErrs.next}</small> : <small className="hint">At least 8 characters with a letter and a number.</small>}
          </label>
          <label>Confirm new password
            <input type="password" {...bind(pw, setPw, "confirm")} autoComplete="new-password" aria-invalid={Boolean(pwErrs.confirm)} />
            {pwErrs.confirm && <small className="err">{pwErrs.confirm}</small>}
          </label>
          <div className="ev-manage"><button className="ev-btn" type="submit" disabled={pwSaving}>{pwSaving ? "Updating..." : "Update password"}</button></div>
        </form>
      </div>
    </PageLayout>
  );
}
