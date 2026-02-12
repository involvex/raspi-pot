const BasePlugin = require('../../server/base-plugin.js');
const { google } = require('googleapis');
const { Mega } = require('megajs');
const fs = require('fs-extra');
const path = require('path');
const multer = require('multer');
const crypto = require('crypto');

class CloudStoragePlugin extends BasePlugin {
  constructor(manifest) {
    super(manifest);
    this.settings = manifest.settings || {};
    this.gdriveTokens = null;
    this.megaClient = null;
    this.uploadDir = path.join(__dirname, '../../../', this.settings.uploadPath || './uploads');

    // Initialize upload directory
    this.ensureUploadDirectory();

    // Configure multer for file uploads
    this.upload = multer({
      storage: multer.diskStorage({
        destination: (req, file, cb) => {
          cb(null, this.uploadDir);
        },
        filename: (req, file, cb) => {
          const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
          cb(null, file.fieldname + '-' + uniqueSuffix + path.extname(file.originalname));
        },
      }),
      limits: {
        fileSize: this.parseSize(this.settings.maxFileSize || '100MB'),
      },
    });
  }

  async ensureUploadDirectory() {
    try {
      await fs.ensureDir(this.uploadDir);
    } catch (error) {
      this.error(`Failed to create upload directory: ${error.message}`);
    }
  }

  parseSize(sizeStr) {
    const units = { B: 1, KB: 1024, MB: 1024 * 1024, GB: 1024 * 1024 * 1024 };
    const match = sizeStr.match(/^(\d+)(B|KB|MB|GB)$/i);
    if (!match) return 100 * 1024 * 1024; // Default 100MB
    return parseInt(match[1]) * units[match[2].toUpperCase()];
  }

  async enable() {
    await super.enable();
    await this.loadSavedTokens();
    this.log('Cloud storage plugin enabled');
  }

  async disable() {
    await this.saveTokens();
    if (this.megaClient) {
      await this.megaClient.close();
      this.megaClient = null;
    }
    await super.disable();
  }

  async onHttpRequest(req, res, next) {
    // Handle all cloud storage API routes
    if (req.path.startsWith('/api/cloud-storage/')) {
      await this.handleCloudStorageRequest(req, res);
      return;
    }
    next();
  }

  async handleCloudStorageRequest(req, res) {
    try {
      const pathParts = req.path.split('/').filter(p => p);
      const service = pathParts[2]; // gdrive, mega
      const action = pathParts[3]; // auth, list, upload, download, etc.

      if (!service || !action) {
        return res.status(400).json({ success: false, error: 'Invalid request' });
      }

      switch (service) {
        case 'gdrive':
          await this.handleGoogleDriveRequest(req, res, action);
          break;
        case 'mega':
          await this.handleMegaRequest(req, res, action);
          break;
        default:
          res.status(400).json({ success: false, error: 'Unknown service' });
      }
    } catch (error) {
      this.error(`Cloud storage request error: ${error.message}`);
      res.status(500).json({ success: false, error: error.message });
    }
  }

  // Google Drive Integration
  async handleGoogleDriveRequest(req, res, action) {
    switch (action) {
      case 'auth':
        await this.handleGDriveAuth(req, res);
        break;
      case 'callback':
        await this.handleGDriveCallback(req, res);
        break;
      case 'list':
        await this.handleGDriveList(req, res);
        break;
      case 'upload':
        this.upload.single('file')(req, res, async err => {
          if (err) {
            return res.status(400).json({ success: false, error: err.message });
          }
          await this.handleGDriveUpload(req, res);
        });
        break;
      case 'download':
        await this.handleGDriveDownload(req, res);
        break;
      case 'delete':
        await this.handleGDriveDelete(req, res);
        break;
      case 'status':
        await this.handleGDriveStatus(req, res);
        break;
      default:
        res.status(400).json({ success: false, error: 'Unknown action' });
    }
  }

  async handleGDriveAuth(req, res) {
    const { clientId } = this.settings.gdrive;
    if (!clientId) {
      return res.status(400).json({ success: false, error: 'Google Drive not configured' });
    }

    const auth = new google.auth.OAuth2(
      clientId,
      this.settings.gdrive.clientSecret,
      this.settings.gdrive.redirectUri
    );

    const authUrl = auth.generateAuthUrl({
      access_type: 'offline',
      scope: ['https://www.googleapis.com/auth/drive.file'],
      prompt: 'consent',
    });

    res.json({ success: true, authUrl });
  }

  async handleGDriveCallback(req, res) {
    const { code } = req.query;
    const { clientId, clientSecret } = this.settings.gdrive;

    const auth = new google.auth.OAuth2(clientId, clientSecret, this.settings.gdrive.redirectUri);

    try {
      const { tokens } = await auth.getToken(code);
      this.gdriveTokens = tokens;
      await this.saveTokens();

      res.send(`
        <html>
          <body>
            <h1>Google Drive Connected Successfully!</h1>
            <p>You can close this window and return to the dashboard.</p>
            <script>
              setTimeout(() => window.close(), 3000);
            </script>
          </body>
        </html>
      `);
    } catch (error) {
      res.status(400).send(`Authentication failed: ${error.message}`);
    }
  }

  async getGDriveClient() {
    if (!this.gdriveTokens) {
      throw new Error('Google Drive not authenticated');
    }

    const auth = new google.auth.OAuth2(
      this.settings.gdrive.clientId,
      this.settings.gdrive.clientSecret,
      this.settings.gdrive.redirectUri
    );

    auth.setCredentials(this.gdriveTokens);

    // Refresh token if needed
    if (auth.isTokenExpiring()) {
      const { credentials } = await auth.refreshAccessToken();
      this.gdriveTokens = credentials;
      await this.saveTokens();
    }

    return google.drive({ version: 'v3', auth });
  }

  async handleGDriveList(req, res) {
    try {
      const drive = await this.getGDriveClient();
      const response = await drive.files.list({
        pageSize: 20,
        fields: 'nextPageToken, files(id, name, mimeType, size, createdTime, modifiedTime)',
        orderBy: 'modifiedTime desc',
      });

      const files = response.data.files.map(file => ({
        id: file.id,
        name: file.name,
        type: file.mimeType === 'application/vnd.google-apps.folder' ? 'folder' : 'file',
        size: file.size || '0',
        createdTime: file.createdTime,
        modifiedTime: file.modifiedTime,
        mimeType: file.mimeType,
      }));

      res.json({ success: true, files });
    } catch (error) {
      res.status(500).json({ success: false, error: error.message });
    }
  }

  async handleGDriveUpload(req, res) {
    if (!req.file) {
      return res.status(400).json({ success: false, error: 'No file uploaded' });
    }

    try {
      const drive = await this.getGDriveClient();

      const fileMetadata = {
        name: req.file.originalname,
        parents: req.body.folderId ? [req.body.folderId] : undefined,
      };

      const media = {
        mimeType: req.file.mimetype,
        body: fs.createReadStream(req.file.path),
      };

      const response = await drive.files.create({
        requestBody: fileMetadata,
        media: media,
        fields: 'id, name, size, createdTime',
      });

      // Clean up uploaded file
      await fs.remove(req.file.path);

      res.json({
        success: true,
        file: {
          id: response.data.id,
          name: response.data.name,
          size: response.data.size,
          createdTime: response.data.createdTime,
        },
      });
    } catch (error) {
      // Clean up uploaded file on error
      if (req.file && req.file.path) {
        await fs.remove(req.file.path);
      }
      res.status(500).json({ success: false, error: error.message });
    }
  }

  async handleGDriveDownload(req, res) {
    const { fileId } = req.query;
    if (!fileId) {
      return res.status(400).json({ success: false, error: 'File ID required' });
    }

    try {
      const drive = await this.getGDriveClient();

      // Get file metadata
      const file = await drive.files.get({ fileId, fields: 'name, mimeType' });

      // Download file
      const response = await drive.files.get({ fileId, alt: 'media' }, { responseType: 'stream' });

      res.setHeader('Content-Disposition', `attachment; filename="${file.data.name}"`);
      res.setHeader('Content-Type', file.data.mimeType);

      response.data.pipe(res);
    } catch (error) {
      res.status(500).json({ success: false, error: error.message });
    }
  }

  async handleGDriveDelete(req, res) {
    const { fileId } = req.body;
    if (!fileId) {
      return res.status(400).json({ success: false, error: 'File ID required' });
    }

    try {
      const drive = await this.getGDriveClient();
      await drive.files.delete({ fileId });
      res.json({ success: true });
    } catch (error) {
      res.status(500).json({ success: false, error: error.message });
    }
  }

  async handleGDriveStatus(req, res) {
    res.json({
      success: true,
      authenticated: !!this.gdriveTokens,
      configured: !!(this.settings.gdrive.clientId && this.settings.gdrive.clientSecret),
    });
  }

  // Mega Integration
  async handleMegaRequest(req, res, action) {
    switch (action) {
      case 'login':
        await this.handleMegaLogin(req, res);
        break;
      case 'list':
        await this.handleMegaList(req, res);
        break;
      case 'upload':
        this.upload.single('file')(req, res, async err => {
          if (err) {
            return res.status(400).json({ success: false, error: err.message });
          }
          await this.handleMegaUpload(req, res);
        });
        break;
      case 'download':
        await this.handleMegaDownload(req, res);
        break;
      case 'delete':
        await this.handleMegaDelete(req, res);
        break;
      case 'status':
        await this.handleMegaStatus(req, res);
        break;
      default:
        res.status(400).json({ success: false, error: 'Unknown action' });
    }
  }

  async handleMegaLogin(req, res) {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ success: false, error: 'Email and password required' });
    }

    try {
      this.megaClient = new Mega({ email, password });
      await this.megaClient.ready;

      // Save credentials (encrypted)
      const encrypted = crypto.createHash('sha256').update(password).digest('hex');
      this.settings.mega.email = email;
      this.settings.mega.encryptedPassword = encrypted;

      res.json({ success: true });
    } catch (error) {
      res.status(400).json({ success: false, error: 'Login failed: ' + error.message });
    }
  }

  async handleMegaList(req, res) {
    if (!this.megaClient) {
      return res.status(400).json({ success: false, error: 'Mega not logged in' });
    }

    try {
      const files = await this.megaClient.files;

      const fileList = files.map(file => ({
        id: file.nodeId,
        name: file.name,
        type: file.directory ? 'folder' : 'file',
        size: file.size ? file.size.toString() : '0',
        createdTime: file.timestamp ? new Date(file.timestamp * 1000).toISOString() : null,
        modifiedTime: file.timestamp ? new Date(file.timestamp * 1000).toISOString() : null,
      }));

      res.json({ success: true, files: fileList });
    } catch (error) {
      res.status(500).json({ success: false, error: error.message });
    }
  }

  async handleMegaUpload(req, res) {
    if (!req.file) {
      return res.status(400).json({ success: false, error: 'No file uploaded' });
    }

    if (!this.megaClient) {
      return res.status(400).json({ success: false, error: 'Mega not logged in' });
    }

    try {
      const buffer = await fs.readFile(req.file.path);
      const upload = await this.megaClient.upload({
        name: req.file.originalname,
        data: buffer,
      });

      // Clean up uploaded file
      await fs.remove(req.file.path);

      res.json({
        success: true,
        file: {
          id: upload.nodeId,
          name: upload.name,
          size: upload.size ? upload.size.toString() : '0',
        },
      });
    } catch (error) {
      // Clean up uploaded file on error
      if (req.file && req.file.path) {
        await fs.remove(req.file.path);
      }
      res.status(500).json({ success: false, error: error.message });
    }
  }

  async handleMegaDownload(req, res) {
    const { fileId } = req.query;
    if (!fileId) {
      return res.status(400).json({ success: false, error: 'File ID required' });
    }

    if (!this.megaClient) {
      return res.status(400).json({ success: false, error: 'Mega not logged in' });
    }

    try {
      const file = await this.megaClient.download({ nodeId: fileId });

      res.setHeader('Content-Disposition', `attachment; filename="${file.name}"`);
      res.setHeader('Content-Type', 'application/octet-stream');

      file.pipe(res);
    } catch (error) {
      res.status(500).json({ success: false, error: error.message });
    }
  }

  async handleMegaDelete(req, res) {
    const { fileId } = req.body;
    if (!fileId) {
      return res.status(400).json({ success: false, error: 'File ID required' });
    }

    if (!this.megaClient) {
      return res.status(400).json({ success: false, error: 'Mega not logged in' });
    }

    try {
      await this.megaClient.delete({ nodeId: fileId });
      res.json({ success: true });
    } catch (error) {
      res.status(500).json({ success: false, error: error.message });
    }
  }

  async handleMegaStatus(req, res) {
    res.json({
      success: true,
      authenticated: !!this.megaClient,
      configured: !!this.settings.mega.email,
    });
  }

  // Token Management
  async saveTokens() {
    try {
      const tokensPath = path.join(__dirname, '../../../tokens.json');
      await fs.writeJson(tokensPath, {
        gdrive: this.gdriveTokens,
        mega: {
          email: this.settings.mega.email,
          encryptedPassword: this.settings.mega.encryptedPassword,
        },
      });
    } catch (error) {
      this.error(`Failed to save tokens: ${error.message}`);
    }
  }

  async loadSavedTokens() {
    try {
      const tokensPath = path.join(__dirname, '../../../tokens.json');
      if (await fs.pathExists(tokensPath)) {
        const tokens = await fs.readJson(tokensPath);
        this.gdriveTokens = tokens.gdrive;

        if (tokens.mega && tokens.mega.email && tokens.mega.encryptedPassword) {
          this.settings.mega.email = tokens.mega.email;
          this.settings.mega.encryptedPassword = tokens.mega.encryptedPassword;
        }
      }
    } catch (error) {
      this.error(`Failed to load tokens: ${error.message}`);
    }
  }

  // Settings Management
  async updateSettings(newSettings) {
    this.settings = { ...this.settings, ...newSettings };
    this.log('Cloud storage settings updated');
  }

  getSettings() {
    // Don't return sensitive data
    return {
      gdrive: {
        enabled: this.settings.gdrive?.enabled || false,
        clientId: this.settings.gdrive?.clientId || '',
        redirectUri: this.settings.gdrive?.redirectUri || '',
      },
      mega: {
        enabled: this.settings.mega?.enabled || false,
        email: this.settings.mega?.email || '',
      },
      uploadPath: this.settings.uploadPath || './uploads',
      maxFileSize: this.settings.maxFileSize || '100MB',
    };
  }
}

module.exports = CloudStoragePlugin;
