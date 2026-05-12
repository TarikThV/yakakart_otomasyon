import { DataTypes, Model } from 'sequelize';
import { sequelize } from '../config/db.ts';

class User extends Model { }

User.init({
    userId: {
        type: DataTypes.INTEGER,
        primaryKey: true,
        autoIncrement: true,
        field: 'id_no'
    },
    fullName: {
        type: DataTypes.STRING,
        allowNull: true,
        field: 'fullname'
    },
    finalist: {
        type: DataTypes.INTEGER,
        allowNull: true,
        field: 'Finalist'
    },
    committee: {
        type: DataTypes.STRING,
        allowNull: true,
        field: 'adminFirstCommitteePreference'
    },
    nationality: {
        type: DataTypes.STRING,
        allowNull: true,
        field: 'country'
    }
}, {
    sequelize,
    modelName: 'User',
    tableName: 'EBALMUN_V1',
    timestamps: false
});


export default User;