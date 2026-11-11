using System;
using System.Collections;
using System.Collections.Generic;
using System.IO;
using System.Net;
using System.Security.Cryptography;
using System.Text;
using System.Web.Script.Serialization;
using Microsoft.Win32;

namespace EndcordInstaller.Core
{
    /// <summary>
    /// Ultime Cord license keys: UC2.&lt;base64url JSON payload&gt;.&lt;base64url r||s ECDSA P-256 signature&gt;.
    /// Keys are made by Sei's owner panel with a private key that never leaves Sei's PC; this exe only has the public key.
    /// A key is locked to one PC (its "code PC", same algorithm as the Discord plugin and install.sh) and can be revoked
    /// through revoked.json on GitHub.
    /// </summary>
    public static class License
    {
        // Public key (P-256), x and y in base64url
        const string PubX = "xaCi140nyu0aCVqcLQzv_LYpcyVwvrzgtkwn3gW2j88";
        const string PubY = "q9sVz2wsuzQ_YFIOXnvoFAnmXdeK7weCpl1RWAF3xHg";
        const string RevokedUrl = "https://raw.githubusercontent.com/lyzral/ultimecord-licenses/main/revoked.json";

        public sealed class Result
        {
            public bool Ok;
            public string Error;
            public string Note;
            public long ExpiresMs;
        }

        public static string SavedKeyPath
        {
            get { return Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.ApplicationData), "UltimeCord", "license.key"); }
        }

        static byte[] FromB64Url(string s)
        {
            string b = s.Replace('-', '+').Replace('_', '/');
            switch (b.Length % 4) { case 2: b += "=="; break; case 3: b += "="; break; }
            return Convert.FromBase64String(b);
        }

        static ECDsaCng PublicKey()
        {
            byte[] x = FromB64Url(PubX), y = FromB64Url(PubY);
            byte[] blob = new byte[8 + 64];
            BitConverter.GetBytes(0x31534345).CopyTo(blob, 0); // "ECS1" = ECDSA P-256 public blob
            BitConverter.GetBytes(32).CopyTo(blob, 4);
            x.CopyTo(blob, 8);
            y.CopyTo(blob, 40);
            return new ECDsaCng(CngKey.Import(blob, CngKeyBlobFormat.EccPublicBlob));
        }

        static string _hwid;

        /// <summary>This PC's code: SHA-256 of the Windows MachineGuid, shown as XXXX-XXXX-XXXX-XXXX.</summary>
        public static string Hwid
        {
            get
            {
                if (_hwid != null) return _hwid;
                string guid = "";
                try
                {
                    using (var hklm = RegistryKey.OpenBaseKey(RegistryHive.LocalMachine, RegistryView.Registry64))
                    using (var k = hklm.OpenSubKey(@"SOFTWARE\Microsoft\Cryptography"))
                    {
                        object v = k != null ? k.GetValue("MachineGuid") : null;
                        // Windows can store the value with a trailing NUL: keep only the GUID itself
                        if (v != null) guid = v.ToString().Trim(new[] { '\0', ' ', '\t', '\r', '\n' }).ToLowerInvariant();
                    }
                }
                catch { }
                if (guid.Length == 0) { _hwid = ""; return _hwid; }
                byte[] h;
                using (var sha = SHA256.Create()) h = sha.ComputeHash(Encoding.UTF8.GetBytes("UC-HW:" + guid));
                var sb = new StringBuilder();
                for (int i = 0; i < 8; i++)
                {
                    if (i > 0 && i % 2 == 0) sb.Append('-');
                    sb.Append(h[i].ToString("X2"));
                }
                _hwid = sb.ToString();
                return _hwid;
            }
        }

        /// <summary>Key ids revoked by Sei. Offline (no answer) gives an empty list so a working key isn't locked out.</summary>
        static List<string> Revoked()
        {
            var ids = new List<string>();
            try
            {
                ServicePointManager.SecurityProtocol |= SecurityProtocolType.Tls12;
                var req = (HttpWebRequest)WebRequest.Create(RevokedUrl + "?t=" + DateTime.UtcNow.Ticks);
                req.Timeout = 5000;
                req.ReadWriteTimeout = 5000;
                req.UserAgent = "UltimeCordInstaller";
                using (var res = (HttpWebResponse)req.GetResponse())
                using (var rd = new StreamReader(res.GetResponseStream(), Encoding.UTF8))
                {
                    var j = new JavaScriptSerializer().Deserialize<Dictionary<string, object>>(rd.ReadToEnd());
                    object v;
                    if (j != null && j.TryGetValue("revoked", out v) && v is IEnumerable)
                        foreach (var o in (IEnumerable)v) if (o != null) ids.Add(o.ToString());
                }
            }
            catch { }
            return ids;
        }

        public static Result Check(string key)
        {
            var r = new Result { Ok = false, Error = "Clé invalide" };
            try
            {
                string[] parts = (key ?? "").Trim().Split('.');
                if (parts.Length != 3 || parts[0] != "UC2") return r;
                byte[] body = FromB64Url(parts[1]);
                byte[] sig = FromB64Url(parts[2]);
                using (var ec = PublicKey())
                {
                    if (!ec.VerifyData(body, sig, HashAlgorithmName.SHA256)) return r;
                }
                var payload = new JavaScriptSerializer().Deserialize<Dictionary<string, object>>(Encoding.UTF8.GetString(body));
                long exp = 0;
                string hw = "", id = "";
                object v;
                if (payload.TryGetValue("exp", out v) && v != null) exp = Convert.ToInt64(v);
                if (payload.TryGetValue("note", out v) && v != null) r.Note = v.ToString();
                if (payload.TryGetValue("hw", out v) && v != null) hw = v.ToString();
                if (payload.TryGetValue("id", out v) && v != null) id = v.ToString();
                long now = (long)(DateTime.UtcNow - new DateTime(1970, 1, 1, 0, 0, 0, DateTimeKind.Utc)).TotalMilliseconds;
                if (exp != 0 && now > exp) { r.Error = "Clé expirée"; return r; }
                if (hw.Length > 0 && hw != Hwid) { r.Error = "Cette clé est liée à un autre PC"; return r; }
                if (id.Length > 0 && Revoked().Contains(id)) { r.Error = "Cette clé a été révoquée"; return r; }
                r.ExpiresMs = exp;
                r.Ok = true;
                r.Error = null;
                return r;
            }
            catch
            {
                return r;
            }
        }

        public static bool HasValidSaved()
        {
            try
            {
                if (!File.Exists(SavedKeyPath)) return false;
                return Check(File.ReadAllText(SavedKeyPath)).Ok;
            }
            catch { return false; }
        }

        public static void Save(string key)
        {
            try
            {
                Directory.CreateDirectory(Path.GetDirectoryName(SavedKeyPath));
                File.WriteAllText(SavedKeyPath, key.Trim());
            }
            catch { }
        }
    }
}
