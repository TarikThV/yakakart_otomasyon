import { DataTypes, Model } from 'sequelize';
import { sequelize } from '../config/db.ts';

class Personnel extends Model { }

Personnel.init({
    personnelId: {
        type: DataTypes.INTEGER,
        primaryKey: true,
        autoIncrement: true,
        field: 'ID'
    },
    fullName: {
        type: DataTypes.STRING,
        allowNull: true,
        field: 'Isim'
    },
    committee: {
        type: DataTypes.STRING,
        allowNull: true,
        field: 'Birim'
    },
    job: {
        type: DataTypes.STRING,
        allowNull: true,
        field: 'Gorev'
    }
}, {
    sequelize,
    modelName: 'Personnel',
    tableName: 'EBALMUN_Personel',
    timestamps: false
});

export default Personnel;