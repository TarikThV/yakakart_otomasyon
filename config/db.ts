import { Sequelize }  from 'sequelize';
import fs from 'fs';


const config = JSON.parse(fs.readFileSync('./assets/dbConfig.json', "utf8"));

// Veritabanı adı, kullanıcı adı ve şifre
const sequelize = new Sequelize(config.dbName, config.userName, config.password, {
    host: config.ip,
    port: config.port,
    dialect: config.dialect,
    logging: false, // Konsolda SQL sorgularını gizlemek için
});


const connectDB = async () => {
    try {
        await sequelize.authenticate();
        console.log('✅ MySQL bağlantısı başarıyla kuruldu.');
    } catch (error) {
        console.error('❌ Bağlantı hatası:', error);
    }
};

export { sequelize, connectDB };