# DevisPro

**DevisPro** is a web application for managing clients, quotes (devis), and invoices (factures) for home service businesses. The app is fully localized in French and provides an intuitive interface for small businesses to streamline their administrative workflow.

---

## 🚀 Fonctionnalités principales

- **Gestion des clients** : Ajoutez, modifiez, supprimez et recherchez des clients.
- **Création de devis et factures** : Générez, éditez, téléchargez et envoyez des devis/factures PDF.
- **Gestion des utilisateurs** : Interface dédiée pour la gestion des utilisateurs et des rôles (admin, super-admin).
- **Notifications** : Système de notifications et d’alertes en français.
- **Interface moderne** : UI responsive, adaptée aux ordinateurs et mobiles.
- **Favicon personnalisé** : Logo visible dans l’onglet du navigateur.

---

## 📦 Structure du projet

```
c:\projects\devis
├── public
│   ├── clients.html
│   ├── dashboard.html
│   ├── index.html
│   ├── register.html
│   ├── users.html
│   ├── css/
│   ├── fonts/
│   ├── images/
│   ├── js/
│   └── uploads/
├── database.sql
├── db.js
├── server.js
├── package.json
├── .env.example
└── ...
```

---

## ⚙️ Installation & Lancement

1. **Cloner le dépôt**
   ```bash
   git clone https://github.com/lotfidridii/DevisPro.git
   cd DevisPro
   ```
2. **Installer les dépendances Node.js**
   ```bash
   npm install
   ```
3. **Configurer l’environnement**
   - Copier `.env.example` en `.env` et renseigner les variables (DB, email, etc.)
4. **Initialiser la base de données**
   - Utiliser le fichier `database.sql` pour créer les tables nécessaires.
   - (Optionnel) Lancer les scripts de migration si besoin.
5. **Démarrer l’application**
   ```bash
   npm start
   # ou pour le développement :
   npm run dev
   ```

L’application sera accessible sur [http://localhost:3001](http://localhost:3001)

---

## 📝 Scripts Utiles

- `initdb.js` : Initialise la base de données.
- `fix_quote_references.js`, `migrate_aides.js`, `migrate_theme_colors.js` : Scripts ponctuels pour migration/correction.

---

## 🖼️ Personnalisation

- **Favicon** : Modifiez `public/images/favicon.png` pour changer le logo de l’application.
- **Polices** : Les fichiers de police sont dans `public/fonts/`.

---

## 📄 Licence

Ce projet est open-source sous licence MIT.

---

## 🙏 Remerciements

Merci d’utiliser DevisPro ! Pour toute suggestion ou bug, ouvrez une issue sur le dépôt GitHub.

---

**Développé par [lotfidridii](https://github.com/lotfidridii)**
