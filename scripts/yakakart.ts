import fs from "fs";
import path from "path";
import {
  componentsToColor,
  PDFDocument,
  PDFPage,
  rgb,
  StandardFonts,
} from "pdf-lib";
import { v4 as uuidv4 } from "uuid";
import fontkit from "@pdf-lib/fontkit";
import * as QRCode from "qrcode";

class Committee {
  constructor(
    public template: string,
    public textColor: number[],
    public templateDoc: PDFDocument,
  ) { }
}

class FontConfig {
  constructor(
    public fontPath: string,
    public fontSize: number,
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
    public fontConfigPath: string,
    public failedUsersPath: string,
    public successfulUsersPath: string,
    public templatesPath: string,
    public usersPath: string,
    public isPersonnel: boolean | null,
  ) { }
}

class ProcessingResult {
  constructor(
    public user: User,
    public successful: boolean,
    public reason: string | null,
  ) { }
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

const processUser = async (user: User, committeeConfig: Record<string, Committee>, fontConfig: FontConfig, isPersonnel: boolean = false) => {
  // Fixing typo issues in names
  if (user.fullName == null) {
    throw new Error("There's no name!");
  }
  if (user.committee == null) {
    throw new Error("There's no committee!");
  }
  if (user.nationality == null && !isPersonnel) {
    throw new Error("There's no nationalitiy!");
  }
  if (user.job == null && isPersonnel) {
    throw new Error("There's no job!");
  }
  if (user.userId == null && user.personnelId == null) {
    throw new Error("The user has no id!");
  }
  user.fullName = titleCase(user.fullName);
  user.fullName = removeSpaces(user.fullName);
  // Check and load committee config
  const committee = committeeConfig[user.committee];
  if (!committee) {
    throw new Error("Invalid committee name!");
  }
  // Check for nationality to not to be empty
  if (user.nationality == "") {
    throw new Error("There's no nationality!");
  }
  // Copy the desired doc for the committee
  let pdfDoc = await committee.templateDoc.copy();
  // Register fontkit and load font settings
  pdfDoc.registerFontkit(fontkit);
  const fontBytes = fs.readFileSync(fontConfig.fontPath);
  let font = await pdfDoc.embedFont(fontBytes, { subset: false });
  // Use first page to edit
  let firstPage = pdfDoc.getPages()[0];
  let { width, height } = firstPage.getSize();
  // Set the text settings
  let textWidth = font.widthOfTextAtSize(user.fullName, 18);
  let textHeight = font.heightAtSize(18);
  let text = user.fullName;
  // Draw the text
  // firstPage.moveTo(
  //   (width - textWidth) / 2,
  //   (height - textHeight) / 2 - textHeight * 0,
  // );
  firstPage.moveTo(
    (width - textWidth) / 2,
    160,
  );
  firstPage.drawText(text, {
    size: 18,
    font: font,
    color: componentsToColor(committeeConfig[user.committee].textColor),
  });
  if (isPersonnel && user.job != null) {
    text = user.job;
  }
  else if (user.nationality != null) {
    text = user.nationality;
  }
  textWidth = font.widthOfTextAtSize(text, fontConfig.fontSize);
  // firstPage.moveTo(
  //   (width - textWidth) / 2,
  //   (height - textHeight) / 2 - textHeight * 1.5,
  // );
  firstPage.moveTo(
    (width - textWidth) / 2,
    134,
  );
  firstPage.drawText(text, {
    size: fontConfig.fontSize,
    font: font,
    color: componentsToColor(committeeConfig[user.committee].textColor),
  });
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

const loadCommitteeConfig = async (committeeConfigPath: string) => {
  if (!fs.existsSync(committeeConfigPath)) {
    throw new Error("Committee config file not found!");
  }
  const committeeConfig: Record<string, Committee> = JSON.parse(
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

const loadTemplates = async (committeeConfig: Record<string, Committee>, templatesPath: string) => {
  if (!fs.existsSync(templatesPath)) {
    throw new Error("Templates folder not found!");
  }
  if (committeeConfig == null) {
    throw new Error("Committee config not loaded! Load it first!");
  }
  for (const [committeeName, committee] of Object.entries(committeeConfig)) {
    if (!fs.existsSync(path.join(templatesPath, committee.template))) {
      throw new Error(`Template file for ${committeeName} not found!`);
    }
    committeeConfig[committeeName].templateDoc = await PDFDocument.load(
      fs.readFileSync(path.join(templatesPath, committee.template)),
    );
  }
}

const loadFontConfig = async (fontConfigPath: string) => {
  if (!fs.existsSync(fontConfigPath)) {
    throw new Error("Font config file not found!");
  }
  const fontConfig: FontConfig = JSON.parse(
    fs.readFileSync(fontConfigPath, "utf8"),
  );
  return fontConfig;
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
  const fontConfig = await loadFontConfig(config.fontConfigPath);
  const resultsFolder = await createResultsFolder();
  await loadTemplates(committeeConfig, config.templatesPath);
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
      let userDocument = await processUser(user, committeeConfig, fontConfig, config.isPersonnel ? config.isPersonnel : false);
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

processAll(ProcessingMode.AllUsers, "./assets/config.json");
processAll(ProcessingMode.AllUsers, "./assets/personnelConfig.json");
