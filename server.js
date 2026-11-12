const express = require('express');
const sqlite3 = require('sqlite3').verbose();
const bodyParser = require('body-parser');
const path = require('path');

const app = express();
const PORT = 3000;

// Identifiants administrateur par défaut
const ADMIN_USER = "admin_uac";
const ADMIN_PASS = "UAC@2026";
const ADMIN_TOKEN = "token-secret-uac-sig-2026";

app.use(bodyParser.json());
app.use(express.static(path.join(__dirname, 'public')));

// Initialisation de la base de données SQLite
const db = new sqlite3.Database('./database.sqlite', (err) => {
    if (err) console.error(err.message);
    console.log('Connecté à la base de données spatiale SQLite.');
});

// Création de la table et insertion des données par défaut de l'UAC
db.serialize(() => {
    db.run(`CREATE TABLE IF NOT EXISTS lieux_uac (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        nom TEXT NOT NULL,
        categorie TEXT NOT NULL,
        description TEXT,
        latitude REAL NOT NULL,
        longitude REAL NOT NULL
    )`);

    // Vérifier si la base est vide pour insérer les données par défaut
    db.get("SELECT COUNT(*) AS count FROM lieux_uac", (err, row) => {
        if (row.count === 0) {
            const stmt = db.prepare("INSERT INTO lieux_uac (nom, categorie, description, latitude, longitude) VALUES (?, ?, ?, ?, ?)");
            // Coordonnées réelles approximatives sur le campus d'Abomey-Calavi
            stmt.run("Rectorat de l'UAC", "Administration", "Bâtiment central de l'administration universitaire.", 6.41445, 2.34065);
            stmt.run("Amphithéâtre Idriss Déby Itno", "Pédagogie", "Grand amphithéâtre de 1500 places.", 6.41610, 2.34215);
            stmt.run("Bibliothèque Centrale (BIDOC)", "Pédagogie", "Centre de documentation et bibliothèque universitaire.", 6.41520, 2.34150);
            stmt.run("Centre des Œuvres Universitaires (COUS-AC)", "Service", "Gestion des résidences, bourses et restauration.", 6.41310, 2.33980);
            stmt.run("École Polytechnique d'Abomey-Calavi (EPAC)", "Faculté / École", "Formation d'ingénieurs et techniciens supérieurs.", 6.41780, 2.34350);
            stmt.run("Faculté des Sciences et Techniques (FAST)", "Faculté / École", "Départements de mathématiques, physique, chimie, biologie.", 6.41680, 2.34010);
            stmt.finalize();
            console.log("Données géographiques par défaut de l'UAC insérées.");
        }
    });
});

// API : Récupérer toutes les données au format GeoJSON standard
app.get('/api/geojson', (req, res) => {
    db.all("SELECT * FROM lieux_uac", [], (err, rows) => {
        if (err) return res.status(500).json({ error: err.message });
        
        const geojson = {
            type: "FeatureCollection",
            features: rows.map(row => ({
                type: "Feature",
                geometry: {
                    type: "Point",
                    coordinates: [row.longitude, row.latitude]
                },
                properties: {
                    id: row.id,
                    nom: row.nom,
                    categorie: row.categorie,
                    description: row.description
                }
            }))
        };
        res.json(geojson);
    });
});

// API : Connexion Administrateur
app.post('/api/login', (req, res) => {
    const { username, password } = req.body;
    if (username === ADMIN_USER && password === ADMIN_PASS) {
        res.json({ success: true, token: ADMIN_TOKEN });
    } else {
        res.status(401).json({ success: false, message: "Identifiants incorrects" });
    }
});

// API : Ajouter un nouveau point sur le campus (Protégé)
app.post('/api/lieux', (req, res) => {
    const token = req.headers['authorization'];
    if (token !== ADMIN_TOKEN) return res.status(403).json({ error: "Accès refusé" });

    const { nom, categorie, description, latitude, longitude } = req.body;
    db.run(
        "INSERT INTO lieux_uac (nom, categorie, description, latitude, longitude) VALUES (?, ?, ?, ?, ?)",
        [nom, categorie, description, latitude, longitude],
        function(err) {
            if (err) return res.status(500).json({ error: err.message });
            res.json({ success: true, id: this.lastID });
        }
    );
});

// API : Supprimer un point (Protégé)
app.delete('/api/lieux/:id', (req, res) => {
    const token = req.headers['authorization'];
    if (token !== ADMIN_TOKEN) return res.status(403).json({ error: "Accès refusé" });

    db.run("DELETE FROM lieux_uac WHERE id = ?", req.params.id, function(err) {
        if (err) return res.status(500).json({ error: err.message });
        res.json({ success: true });
    });
});

app.listen(PORT, () => {
    console.log(`Serveur SIG Web UAC démarré sur http://localhost:${PORT}`);
});
