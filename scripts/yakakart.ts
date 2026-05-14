import fs from "fs";
import path from "path";
import {
  asNumber,
  Color,
  componentsToColor,
  PDFDocument,
  PDFFont,
  PDFPage,
  rgb,
  StandardFonts,
} from "pdf-lib";
import { v4 as uuidv4 } from "uuid";
import fontkit, { Font } from "@pdf-lib/fontkit";
import * as QRCode from "qrcode";

class CommitteeConfig {
  constructor(
    public templatePath: string,
    public templateDoc: PDFDocument,
    public textConfigPaths: string[],
    public textConfigs: TextConfig[]
  ) { }
}

class User {
  constructor(
    public userId: number | null,
    public fullName: string | null,
    public finalist: number | null,
    public committee: string | null,
    public nationality: string | null,
    public personnelId: string | null,
    public unit: string | null,
    public job: string | null,
  ) { }
}

class Config {
  constructor(
    public committeeConfigPath: string,
    public failedUsersPath: string,
    public successfulUsersPath: string,
    public templatesPath: string,
    public usersPath: string,
  ) { }
}

class ProcessingResult {
  constructor(
    public user: User,
    public successful: boolean,
    public reason: string | null,
  ) { }
}


class TextConfig {
  constructor(
    public field: string,
    public fontPath: string,
    public fontBytes: Buffer,
    public x: string,
    public y: string,
    public fontSize: string,
    public color: number[],
    public prepared: boolean = false,
    public page: string,
  ) { }

}
class TextSettings {
  constructor(
    public text: string,
    public font: PDFFont,
    public x: string,
    public y: string,
    public fontSize: string,
    public color: number[],
    public page: string,
  ) {
  }

}

enum ProcessingMode {
  AllUsers,
  OnlyFailedUsers,
}

enum QrProcessingMode {
  ProcessId,
  ProcessPersonnelId,
}



const loadConfig = async (configPath: string) => {
  if (!fs.existsSync(configPath)) {
    throw new Error("Config file not found!");
  }
  const config: Config = JSON.parse(fs.readFileSync(configPath, "utf8"));
  return config;
}


const removeSpaces = (str: string) => {
  return str
    .split(" ")
    .filter((word) => !word.includes(' '))
    .join(" ");
}

const titleCase = (str: string) => {
  return str
    .toLowerCase()
    .split(" ")
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
};

const test = async () => {
  const document = await PDFDocument.load(
    fs.readFileSync("./templates/who.pdf"),
  );
  const firstPage = await document.getPage(0);
  console.log(firstPage.getSize());
  const qrCodeData = await QRCode.toBuffer("https://ebalmun.com.tr", {
    width: 512,
    margin: 2,
  });
  const qrImage = await document.embedPng(qrCodeData);
  firstPage.drawImage(qrImage, {
    x: 120 - 25,
    y: 82 - 25,
    width: 50,
    height: 50,
  });
  const pdfBytes = await document.save();
  fs.writeFileSync("./results/test.pdf", pdfBytes);
};


const prepareTextConfig = async (pdfDoc: PDFDocument, textConfig: TextConfig) => {
  if (!fs.existsSync(textConfig.fontPath)) {
    throw new Error(`Couldn't find font in: ${textConfig.fontPath}!`);
  }
  textConfig.fontBytes = fs.readFileSync(textConfig.fontPath);
  textConfig.prepared = true;
}

const prepareText = async (textConfig: TextConfig, object: any, pdfDoc: PDFDocument) => {
  if (!textConfig.prepared) {
    throw new Error(`TextConfig is not prepared, call prepareTextConfig first!`);
  }
  if (!object[textConfig.field]) {
    throw new Error(`Object ${object.toString()} has no field named: ${textConfig.field}`);
  }
  if (object[textConfig.field] == null) {
    throw new Error(`Object ${object.toString()} has a null field named: ${textConfig.field}`);
  }
  const text = object[textConfig.field].toString();
  pdfDoc.registerFontkit(fontkit);
  const font = await pdfDoc.embedFont(textConfig.fontBytes);
  return new TextSettings(text, font, textConfig.x, textConfig.y, textConfig.fontSize, textConfig.color, textConfig.page);
}

const processText = async (text: TextSettings, pdfDocument: PDFDocument) => {
  const pdfPage = pdfDocument.getPage(eval(text.page));
  const width = text.font.widthOfTextAtSize(text.text, asNumber(eval(text.fontSize)));
  const height = text.font.heightAtSize(asNumber(eval(text.fontSize)));
  pdfPage.moveTo(eval(text.x), eval(text.y));
  pdfPage.drawText(text.text, {
    color: componentsToColor(text.color),
    font: text.font,
    size: asNumber(eval(text.fontSize)),
  })
}

const processUser = async (user: User, committeeConfig: Record<string, CommitteeConfig>) => {
  // Fixing typo issues in names
  if (user.fullName == null) {
    throw new Error("There's no name!");
  }
  if (user.committee == null) {
    throw new Error("There's no committee!");
  }
  if (user.userId == null && user.personnelId == null) {
    throw new Error("The user has no id!");
  }
  // Check and load committee config
  const committee = committeeConfig[user.committee];
  if (!committee) {
    throw new Error("Invalid committee name!");
  }
  user.fullName = titleCase(user.fullName);
  user.fullName = removeSpaces(user.fullName);
  // Copy the desired doc for the committee
  let pdfDoc = await committee.templateDoc.copy();
  for (const textConfig of committee.textConfigs) {
    const text = await prepareText(textConfig, user, pdfDoc);
    await processText(text, pdfDoc);
  }
  const firstPage = pdfDoc.getPage(0);

  const id = user.userId ? user.userId.toString() : user.personnelId ? user.personnelId : "NULL";
  const qrCodeData = await QRCode.toBuffer(id, {
    width: 200,
    margin: 2,
  });
  const qrImage = await pdfDoc.embedPng(qrCodeData);
  firstPage.drawImage(qrImage, {
    x: 120 - 24,
    y: 82 - 24,
    width: 48,
    height: 48,
  });
  return pdfDoc;
}

const loadTextConfigs = async (textConfigPath: string) => {
  if (!fs.existsSync(textConfigPath)) {
    throw new Error("Text config file not found!");
  }
  const textConfig: TextConfig[] = JSON.parse(fs.readFileSync(textConfigPath, "utf8"));
  return textConfig;
}


const loadCommitteeConfig = async (committeeConfigPath: string) => {
  if (!fs.existsSync(committeeConfigPath)) {
    throw new Error("Committee config file not found!");
  }
  const committeeConfig: Record<string, CommitteeConfig> = JSON.parse(
    fs.readFileSync(committeeConfigPath, "utf8")
  );
  return committeeConfig;
}

const loadUsers = async (usersPath: string) => {
  if (!fs.existsSync(usersPath)) {
    throw new Error("Users file not found!");
  }
  const users: User[] = JSON.parse(
    fs.readFileSync(usersPath, "utf8"),
  );
  return users;
}



const prepareCommitteeConfigs = async (committeeConfig: Record<string, CommitteeConfig>, templatesPath: string) => {
  if (!fs.existsSync(templatesPath)) {
    throw new Error("Templates folder not found!");
  }
  if (committeeConfig == null) {
    throw new Error("Committee config not loaded! Load it first!");
  }
  for (const [committeeName, committee] of Object.entries(committeeConfig)) {
    if (!fs.existsSync(path.join(templatesPath, committee.templatePath))) {
      throw new Error(`Template file for ${committeeName} not found!`);
    }
    committeeConfig[committeeName].templateDoc = await PDFDocument.load(
      fs.readFileSync(path.join(templatesPath, committee.templatePath)),
    );
    committeeConfig[committeeName].textConfigs = [];
    for (const textConfigPath of committee.textConfigPaths) {
      if (!fs.existsSync(textConfigPath)) {
        throw new Error(`Text configs for ${committee} not found!`);
      }
      const textConfig = JSON.parse(
        fs.readFileSync(textConfigPath, "utf8")
      );
      committeeConfig[committeeName].textConfigs.push(textConfig);
      prepareTextConfig(committee.templateDoc, textConfig);
    }
  }
}


const createResultsFolder = async () => {
  const resultsFolder = path.join("./results/", uuidv4());
  if (!(fs.existsSync("./results/"))) {
    fs.mkdirSync("./results/");
  }
  fs.mkdirSync(resultsFolder);
  return resultsFolder;
}


const loadProcessingResults = async (processingResultsPath: string) => {
  if (!fs.existsSync(processingResultsPath)) {
    throw new Error("Processing results file not found!");
  }
  const processingResults: ProcessingResult[] = JSON.parse(
    fs.readFileSync(processingResultsPath, "utf8"),
  )
  return processingResults;
}

const processAll = async (processingMode: ProcessingMode, configPath: string) => {
  const config = await loadConfig(configPath);
  const committeeConfig = await loadCommitteeConfig(config.committeeConfigPath);
  const resultsFolder = await createResultsFolder();
  await prepareCommitteeConfigs(committeeConfig, config.templatesPath);
  let users: User[] = [];


  if (processingMode === ProcessingMode.OnlyFailedUsers) {
    const processingResults = await loadProcessingResults(config.failedUsersPath);
    processingResults.forEach((result) => {
      users.push(result.user);
    });
  }
  else {
    users = await loadUsers(config.usersPath);
  }
  console.log(`Processing ${users.length} users...`);

  // Arrays to store results
  const successfulUsers = [];
  const failedUsers = [];

  for (const user of users) {
    try {
      let userDocument = await processUser(user, committeeConfig);
      const resultPath = path.join(resultsFolder, `${user.userId}-${user.fullName}-${user.committee}.pdf`);
      fs.writeFileSync(resultPath, await userDocument.save());
      successfulUsers.push(new ProcessingResult(user, true, null));
      console.log(`✅ ${user.fullName} processed successfully.`);
    }
    catch (error) {
      failedUsers.push(new ProcessingResult(user, false, (error as Error).message));
      console.log(`❌ ${user.fullName} failed to process. Reason: ${(error as Error).message}`);
    }
  }

  fs.writeFileSync(
    path.join(resultsFolder, "successful.json"),
    JSON.stringify(successfulUsers, null, 2),
  );
  fs.writeFileSync(
    path.join(resultsFolder, "failed.json"),
    JSON.stringify(failedUsers, null, 2),
  );

  console.log(`✅ ${successfulUsers.length} users processed successfully.`);
  console.log(`❌ ${failedUsers.length} users failed to process.`);
  console.log(`Results saved to ${resultsFolder}`);
}

processAll(ProcessingMode.AllUsers, "./assets/certificateConfig.json");
// processAll(ProcessingMode.AllUsers, "./assets/personnelConfig.json");
