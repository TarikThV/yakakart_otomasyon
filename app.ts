import { connectDB, sequelize } from './config/db';
import User from './models/user.ts';
import Personnel from './models/personnel.ts';
import fs from 'fs';
import { Op } from 'sequelize';
import { parse } from 'csv-parse/sync';

class CsvRecord {
    constructor(
        public Delegate: string,
        public Committee: string,
        public Assignment: string,
        public Status: string | null,
    ) { }
}

const fetchUsers = async () => {
    try {
        // 1. Veritabanına bağlan
        await connectDB();

        // 2. İlk 300 kullanıcıyı getir
        // limit: Kaç kayıt alınacağını belirler
        // order: Hangi sıraya göre alınacağını belirler (Genelde ID'ye göre artan - ASC)
        const users = await User.findAll({
            limit: 300,
            where: {
                finalist: 1
            },
            order: [['userId', 'ASC']],
        });

        const personnels = await Personnel.findAll({
            limit: 300,
            where: {
                [Op.or]: [
                    { job: "Admin" },
                    { job: "Reporter" }
                ]
            }
        });

        console.log(`✅ Toplam ${users.length} kullanıcı getirildi.`);

        // Verileri listele (opsiyonel)
        fs.writeFileSync("./status/delegates.json", JSON.stringify(users));
        fs.writeFileSync("./status/personnels.json", JSON.stringify(personnels));
        console.log("Delegates and personnels have been saved to status/ folder");

    } catch (error) {
        console.error('❌ Veri çekme hatası:', error);
    } finally {
        // İşlem bitince bağlantıyı kapatmak isterseniz:
        // await sequelize.close();
    }
};


const updateDb = async () => {
    const csvContent = fs.readFileSync("./assets/Ebalmun_Tam_Dağılım.csv");
    const records: CsvRecord[] = parse(csvContent, {
        columns: true, // İlk satırı başlık olarak al
        skip_empty_lines: true,
        bom: true,
        trim: true,
    });
    console.log(`Total records: ${records.length}`);
    for (const record of records) {
        console.log(`Processing: ${record.Delegate}`);
        const result = await User.update({
            finalist: 1,
            committee: record.Committee,
            nationality: record.Assignment
        }, {
            where: {
                fullName: record.Delegate
            }
        });
        console.log(`Updated ${result[0]} records for ${record.Delegate}`);
    }
}

fetchUsers();