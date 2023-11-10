const express = require("express");
const cors = require("cors");
const mysql = require("mysql2/promise");
const dotenv = require("dotenv").config();

const app = express();

const port = process.env.PORT;

const pool = mysql.createPool({
  host: process.env.DB_HOST,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_DATABASE,
});

// Middleware
app.use(async function (req, res, next) {
  try {
    req.db = await pool.getConnection();
    req.db.connection.config.namedPlaceholders = true;

    await req.db.query(`SET SESSION sql_mode = "TRADITIONAL"`);
    await req.db.query(`SET time_zone = '-8:00'`);

    await next();

    req.db.release();
  } catch (err) {
    console.log(err);

    if (req.db) req.db.release();
    throw err;
  }
});

app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Routes
app.get("/cars", async function (req, res) {
  try {
    const [rows, fields] = await req.db.query("SELECT * FROM Cars");

    res.json({
      success: true,
      message: "Cars successfully retrieved",
      data: rows,
    });
  } catch (err) {
    res.json({ success: false, message: err.message, data: null });
  }
});

app.post("/car", async function (req, res) {
  try {
    const { make, model, year } = req.body;

    const [result] = await req.db.query(
      `INSERT INTO Cars (make, model, year) 
      VALUES (?, ?, ?)`,
      [make, model, year]
    );

    const newCarId = result.insertId;

    const [newCar] = await req.db.query("SELECT * FROM Cars WHERE id = ?", [
      newCarId,
    ]);

    res.json({
      success: true,
      message: "Car successfully created",
      data: newCar,
    });
  } catch (err) {
    res.json({ success: false, message: err.message, data: null });
  }
});

app.put("/car/:id", async function (req, res) {
  try {
    const carId = req.params.id;
    const { make, model, year } = req.body;

    const [existingCar] = await req.db.query(
      "SELECT * FROM Cars WHERE id = ?",
      [carId]
    );

    if (!existingCar) {
      return res.json({ success: false, message: "Car not found", data: null });
    }

    let updateFields = [];
    let updateValues = [];

    if (make !== undefined) {
      updateFields.push("make = ?");
      updateValues.push(make);
    }

    if (model !== undefined) {
      updateFields.push("model = ?");
      updateValues.push(model);
    }

    if (year !== undefined) {
      updateFields.push("year = ?");
      updateValues.push(year);
    }

    if (updateFields.length === 0) {
      // No fields to update
      return res.json({
        success: false,
        message: "No fields to update",
        data: existingCar,
      });
    }

    // Construct the final update query
    const updateQuery = `UPDATE Cars SET ${updateFields.join(
      ", "
    )} WHERE id = ?`;

    // Execute the update query
    await req.db.query(updateQuery, [...updateValues, carId]);

    // Retrieve the updated car details
    const [updatedCar] = await req.db.query("SELECT * FROM Cars WHERE id = ?", [
      carId,
    ]);

    res.json({
      success: true,
      message: "Car successfully updated",
      data: updatedCar,
    });
  } catch (err) {
    res.json({ success: false, message: err.message, data: null });
  }
});

app.delete("/car/:id", async function (req, res) {
  try {
    const carId = req.params.id;

    // Check if the car with the specified ID exists
    const [existingCar] = await req.db.query(
      "SELECT * FROM Cars WHERE id = ?",
      [carId]
    );

    if (!existingCar) {
      return res.json({ success: false, message: "Car not found", data: null });
    }

    await req.db.query("UPDATE Cars SET deleted_flah = 1 WHERE id = ?", [
      carId,
    ]);

    res.json({
      success: true,
      message: "Car successfully marked as deleted",
      data: existingCar,
    });
  } catch (err) {
    res.json({ success: false, message: err.message, data: null });
  }
});

app.listen(port, () =>
  console.log(`212 API Example listening on http://localhost:${port}`)
);
