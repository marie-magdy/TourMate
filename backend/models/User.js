import { DataTypes } from 'sequelize';
import sequelize from '../config/database.js';
import pool from '../src/db.js';

const User = sequelize.define(
  'User',
  {
    user_id: {
      type: DataTypes.STRING,
      primaryKey: true,
      allowNull: false,
    },
    name: {
      type: DataTypes.STRING,
      allowNull: false,
    },
    email: {
      type: DataTypes.STRING,
      allowNull: false,
      unique: true,
    },
    password: {
      type: DataTypes.STRING,
      allowNull: false,
    },
    language: {
      type: DataTypes.STRING,
      defaultValue: 'English',
    },
    current_city: {
      type: DataTypes.STRING,
      defaultValue: 'Cairo',
    },
    accessibility_needs: {
      type: DataTypes.STRING,
      defaultValue: 'None',
    },
    is_admin: {
      type: DataTypes.BOOLEAN,
      defaultValue: false,
    },
    eco_points: {
      type: DataTypes.INTEGER,
      defaultValue: 0,
    },
    sustainability_level: {
      type: DataTypes.STRING,
      defaultValue: 'Bronze',
    },
    latitude: {
      type: DataTypes.FLOAT,
      allowNull: true,
    },
    longitude: {
      type: DataTypes.FLOAT,
      allowNull: true,
    },
  },
  {
    tableName: 'users',
    timestamps: true,
  }
);

/**
 * Generate next sequential user ID
 * Format: USR001, USR002, etc.
 */
export async function generateNextUserId() {
  try {
    // Query the database directly to get the highest user_id
    const result = await pool.query(
      `SELECT user_id FROM users 
       WHERE user_id LIKE 'USR%' 
       ORDER BY CAST(SUBSTRING(user_id, 4) AS INTEGER) DESC 
       LIMIT 1`
    );

    let nextNumber = 1;
    if (result.rows.length > 0) {
      const lastId = result.rows[0].user_id;
      const lastNumber = parseInt(lastId.substring(3));
      nextNumber = lastNumber + 1;
    }

    return `USR${String(nextNumber).padStart(3, '0')}`;
  } catch (err) {
    console.error('Error generating user ID:', err);
    throw err;
  }
}

export default User;
