import { PDFDocument } from "pdf-lib";
import fs from 'fs';


/**
 * Birden fazla PDF dosyasını tek bir PDF'te birleştirir.
 * @param {string[]} pdfPaths - Birleştirilecek PDF dosyalarının yolları.
 * @param {string} outputPath - Çıktı dosyasının yolu.
 */
async function mergePDFs(pdfPaths: string[], outputPath: string) {
    try {
        // 1. Yeni ve boş bir PDF dokümanı oluştur
        const mergedPdf = await PDFDocument.create();

        for (const pdfPath of pdfPaths) {
            // 2. Mevcut PDF dosyasını oku
            const pdfBytes = fs.readFileSync(pdfPath);
            const pdfDoc = await PDFDocument.load(pdfBytes);

            // 3. Mevcut PDF'in tüm sayfalarını seç
            const copiedPages = await mergedPdf.copyPages(
                pdfDoc, 
                pdfDoc.getPageIndices()
            );

            // 4. Sayfaları yeni dokümana ekle
            copiedPages.forEach((page) => {
                mergedPdf.addPage(page);
            });
            
            console.log(`Eklendi: ${pdfPath}`);
        }

        // 5. Birleştirilmiş PDF'i byte dizisi olarak kaydet
        const mergedPdfBytes = await mergedPdf.save();

        // 6. Dosyayı sisteme yaz
        await fs.writeFile(outputPath, mergedPdfBytes, ()=> null);
        console.log(`--- İşlem Başarılı: ${outputPath} oluşturuldu ---`);

    } catch (error) {
        console.error('Hata oluştu:', error);
    }
}



const folder1 = "./results/cc640c0f-36f0-41db-b99c-5bf30591d3b2";
const folder2 = "./results/d3936669-fce6-4f4b-9c29-a0892b459b8a";

const files1 = fs.readdirSync(folder1);
const files2 = fs.readdirSync(folder2);

let pdfFiles: string[] = [];
for (const file of files1) {
    if (file.endsWith(".pdf")) {
        pdfFiles.push(file);
    }
}

for (const file of files2) {
    if (file.endsWith(".pdf")) {
        pdfFiles.push(file);
    }
}


mergePDFs(pdfFiles, "./results/birleşik.pdf");