const express = require('express');
const path = require('path');
const mysql = require('mysql2');
const bodyParser = require('body-parser');

const app = express();

// Set up Express middleware
app.use(express.static(path.join(__dirname, 'public')));
app.set('view engine', 'ejs');
app.use(express.json());
app.set('views', path.join(__dirname, 'views'));
app.use(bodyParser.urlencoded({ extended: true }));

// Database variables
let dbtable = null;
let dbconnection = null;

// Function to connect to the database
const connect = async (host, user, password, database) => {
    return new Promise((resolve, reject) => {
        const connection = mysql.createConnection({ host, user, password, database });

        connection.connect((err) => {
            if (err) reject(err);
            else {
                dbconnection = connection;
                resolve(connection);
            }
        });
    });
};

// Helper function to execute queries (fixing async issues)
const executeQuery = (query, values = []) => {
    return new Promise((resolve, reject) => {
        dbconnection.query(query, values, (err, results) => {
            if (err) reject(err);
            resolve(results);
        });
    });
};

// Function to fetch data from the table
const getData = async () => {
    if (!dbconnection || !dbtable) throw "Database connection or table is not set.";
    return executeQuery(`SELECT * FROM ??`, [dbtable]);
};

// Function to fetch table columns
const getColumns = async () => {
    if (!dbconnection || !dbtable) throw "Database connection or table is not set.";
    const results = await executeQuery(`DESC ??`, [dbtable]);

    return results.map(item => ({
        field: item.Field,
        type: setType(item.Type),
    }));
};

const getTables = async () => {
    if (!dbconnection) throw "Database connection is not set.";
    const results = await executeQuery(`SHOW TABLES`);
    return results.map(item => item[`Tables_in_${dbconnection.config.database}`]);
}
// Helper function to determine column type
const setType = (type) => {
    if (type.includes('int')) return 'number';
    if (type.includes('varchar') || type.includes('char')) return 'text';
    if (type.includes('date')) return 'date';
    return 'text'; // Default to 'text' instead of 'unknown'
};

const allData = async (req, res) => {
    const data = await getData();
    const cols = await getColumns();
    const tables = await getTables();
    res.render('form', { data: data, cols: cols , tables: tables});
}
// Route for home page
app.get('/', (req, res) => {
    res.render('database', { message: "" });
});

// Route to connect to the database and retrieve data
app.post('/panel', async (req, res) => {
    try {
        const { host, user, password, database, table } = req.body;
        dbtable = table;
        await connect(host, user, password, database);
        await allData(req, res);
    } catch (err) {
        console.error(err);
        res.render('database', { message: "Incorrect Credentials" });
    }
});

app.post('/panel/table', async (req, res) => {
    try {
        const { table } = req.body;
        dbtable = table;
        await allData(req, res);
    } catch (err) {
        console.error(err);
        res.render('database', { message: "Incorrect Credentials" });
    }
});

// Route to submit data
app.post('/panel/submit', async (req, res) => {
    try {
        const cols = await getColumns();
        const fields = cols.map(item => item.field);
        const values = cols.map(item => req.body[item.field]);
        await executeQuery(
            `INSERT INTO ?? (${fields.join(',')}) VALUES (?)`,
            [dbtable, values]
        );
        await allData(req, res);
    } catch (err) {
        console.log(err);
        res.status(500).send("Error inserting data");
    }
});

// Route to delete data
app.delete('/delete', async (req, res) => {
    try {
        const { data, type } = req.body;
        const idValue = isNaN(data) ? data : Number(data); // Convert ID if needed

        await executeQuery(`DELETE FROM ?? WHERE ?? = ?`, [dbtable, type, idValue]);
        await allData(req, res);
    } catch (err) {
        console.log(err);
        res.status(500).json({ error: "Deletion failed" });
    }
});

