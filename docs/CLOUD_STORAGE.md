# Cloud Storage Plugin

The Cloud Storage plugin provides seamless integration with popular cloud storage services, allowing you to manage your files directly from the RaspiPot dashboard. Currently supports Google Drive and Mega.nz.

## Features

### Google Drive Integration

- **Authentication**: OAuth2-based secure authentication
- **File Management**: Upload, download, delete files
- **Folder Support**: Navigate and manage folders
- **Real-time Sync**: Automatic refresh of file listings
- **Large File Support**: Handle files up to configured limits

### Mega.nz Integration

- **Secure Login**: Encrypted credential storage
- **File Operations**: Complete file management
- **Cloud Storage**: Access your Mega storage space
- **Fast Uploads**: Optimized for Raspberry Pi performance

### Security Features

- **Token Encryption**: Secure storage of authentication tokens
- **Permission Control**: Granular access permissions
- **Session Management**: Automatic token refresh
- **Local Storage**: Credentials stored locally on Pi

## Installation

### Prerequisites

1. Ensure the plugin system is enabled
2. Install required dependencies:
   ```bash
   npm install googleapis megajs multer
   ```

### Plugin Setup

1. Navigate to **Plugins** in the dashboard
2. Install the **cloud-storage** plugin
3. Enable the plugin through the plugin management interface
4. Configure your cloud storage credentials

## Configuration

### Google Drive Setup

1. **Create Google Cloud Project**:
   - Go to [Google Cloud Console](https://console.cloud.google.com/)
   - Create a new project or select existing one
   - Enable Google Drive API

2. **Create OAuth2 Credentials**:
   - Go to APIs & Services > Credentials
   - Create OAuth2 Client ID
   - Select "Web application"
   - Add redirect URI: `http://your-pi-ip:3000/api/cloud-storage/gdrive/callback`
   - Note the Client ID and Client Secret

3. **Configure in Dashboard**:
   - Go to Cloud Storage > Settings
   - Enter your Client ID and Client Secret
   - Enable Google Drive

### Mega Setup

1. **Create Mega Account**:
   - Sign up at [mega.nz](https://mega.nz/)
   - Verify your email address

2. **Configure in Dashboard**:
   - Go to Cloud Storage > Mega tab
   - Enter your email and password
   - Click "Connect to Mega"

## Usage

### File Management

#### Upload Files

1. Click the "Upload File" button
2. Select file from your computer
3. File uploads to selected cloud service
4. Progress shown in the interface

#### Download Files

1. Click the download icon next to any file
2. File downloads to your default download location
3. Large files show download progress

#### Delete Files

1. Click the delete icon next to any file
2. Confirm deletion in the dialog
3. File permanently removed from cloud storage

#### Refresh File List

1. Click the "Refresh" button
2. Latest file listing retrieved from cloud service
3. Changes reflected immediately

### Interface Navigation

#### Tab System

- **Google Drive Tab**: Manage Google Drive files
- **Mega Tab**: Manage Mega files
- **Status Indicators**: Show authentication status

#### Authentication Status

- 🟢 Green: Authenticated and connected
- 🔴 Red: Not authenticated
- 🟡 Yellow: Configuration needed

#### Settings Panel

- Configure API credentials
- Enable/disable services
- Set upload limits
- Manage preferences

## API Reference

### Google Drive Endpoints

#### Authentication

```http
GET /api/cloud-storage/gdrive/auth
POST /api/cloud-storage/gdrive/callback
```

#### File Operations

```http
GET /api/cloud-storage/gdrive/list
POST /api/cloud-storage/gdrive/upload
GET /api/cloud-storage/gdrive/download?fileId={id}
POST /api/cloud-storage/gdrive/delete
GET /api/cloud-storage/gdrive/status
```

### Mega Endpoints

#### Authentication

```http
POST /api/cloud-storage/mega/login
```

#### File Operations

```http
GET /api/cloud-storage/mega/list
POST /api/cloud-storage/mega/upload
GET /api/cloud-storage/mega/download?fileId={id}
POST /api/cloud-storage/mega/delete
GET /api/cloud-storage/mega/status
```

## Security Considerations

### Data Protection

- **Local Storage**: All credentials stored locally on Raspberry Pi
- **Encryption**: Sensitive data encrypted at rest
- **No Cloud Storage**: Credentials never sent to external servers
- **Session Management**: Automatic token expiration and refresh

### Best Practices

1. **Strong Passwords**: Use unique, strong passwords for Mega
2. **API Security**: Keep Google Drive credentials secure
3. **Regular Updates**: Keep plugin updated for security patches
4. **Access Control**: Limit dashboard access to trusted users

### Token Management

- Google Drive tokens automatically refresh
- Mega credentials encrypted with SHA-256
- Tokens stored in `tokens.json` file
- Manual token deletion possible through settings

## Performance Optimization

### Raspberry Pi Considerations

- **Chunked Uploads**: Large files uploaded in chunks
- **Memory Management**: Efficient memory usage for file operations
- **Background Processing**: Non-blocking file operations
- **Cache Control**: Intelligent caching of file metadata

### Upload Limits

- Default: 100MB per file
- Configurable through settings
- Progress indicators for large files
- Automatic retry on failed uploads

## Troubleshooting

### Common Issues

#### Google Drive Authentication Failed

**Problem**: OAuth authentication window doesn't appear or fails
**Solution**:

1. Check Client ID and Client Secret in settings
2. Verify redirect URI matches Google Cloud Console
3. Ensure Google Drive API is enabled
4. Check network connectivity

#### Mega Login Failed

**Problem**: Unable to connect to Mega account
**Solution**:

1. Verify email and password are correct
2. Check for two-factor authentication
3. Ensure account is verified
4. Try resetting Mega password

#### File Upload Fails

**Problem**: File uploads don't complete
**Solution**:

1. Check file size doesn't exceed limits
2. Verify available storage space
3. Check network connection stability
4. Review plugin logs for errors

#### Download Issues

**Problem**: Files won't download or are corrupted
**Solution**:

1. Check available disk space
2. Verify file permissions
3. Try downloading smaller files first
4. Clear browser cache if using web interface

### Debug Information

#### Enable Debug Logging

```javascript
// In plugin settings
{
  "debug": true,
  "logLevel": "verbose"
}
```

#### Check Plugin Status

```bash
# Check if plugin is running
curl http://localhost:3000/api/plugins

# Check cloud storage status
curl http://localhost:3000/api/cloud-storage/gdrive/status
curl http://localhost:3000/api/cloud-storage/mega/status
```

#### Log Files

- Plugin logs: `logs/cloud-storage.log`
- System logs: `logs/raspipot.log`
- Error logs: `logs/errors.log`

## Advanced Configuration

### Custom Settings

```json
{
  "gdrive": {
    "enabled": true,
    "clientId": "your-client-id",
    "clientSecret": "your-client-secret",
    "redirectUri": "http://localhost:3000/api/cloud-storage/gdrive/callback",
    "scope": "https://www.googleapis.com/auth/drive.file"
  },
  "mega": {
    "enabled": true,
    "email": "your-email@mega.nz",
    "encryptedPassword": "encrypted-hash"
  },
  "uploadPath": "./uploads",
  "maxFileSize": "100MB",
  "chunkSize": "1MB",
  "retryAttempts": 3,
  "timeout": 30000
}
```

### Environment Variables

```bash
# Google Drive
GDRIVE_CLIENT_ID=your-client-id
GDRIVE_CLIENT_SECRET=your-client-secret

# Mega
MEGA_EMAIL=your-email@mega.nz
MEGA_PASSWORD=your-password

# General
CLOUD_STORAGE_UPLOAD_PATH=/path/to/uploads
CLOUD_STORAGE_MAX_SIZE=100MB
```

## Integration Examples

### Script Integration

```bash
# Upload file via API
curl -X POST \
  -F "file=@/path/to/file.txt" \
  http://localhost:3000/api/cloud-storage/gdrive/upload

# Download file via API
curl -o downloaded-file.txt \
  "http://localhost:3000/api/cloud-storage/gdrive/download?fileId=FILE_ID"
```

### Automation

```javascript
// Automated backup script
const fs = require('fs');
const path = require('path');

async function backupToCloud(filePath, service) {
  const formData = new FormData();
  formData.append('file', fs.createReadStream(filePath));

  const response = await fetch(`/api/cloud-storage/${service}/upload`, {
    method: 'POST',
    body: formData,
  });

  return response.json();
}
```

## Plugin Development

### Extending the Plugin

The cloud storage plugin is designed to be extensible:

```javascript
// Add new cloud service
class DropboxProvider extends BaseProvider {
  async authenticate() {
    // Dropbox OAuth implementation
  }

  async upload(file) {
    // Dropbox upload implementation
  }
}
```

### Custom Providers

1. Create provider class extending `BaseProvider`
2. Implement required methods
3. Register provider in plugin configuration
4. Add UI components for new service

## Support and Contributing

### Getting Help

- **Documentation**: Check this guide first
- **Issues**: Report bugs on GitHub
- **Community**: Join our Discord server
- **FAQ**: See frequently asked questions

### Contributing

1. Fork the repository
2. Create feature branch
3. Implement your changes
4. Add tests and documentation
5. Submit pull request

### License

This plugin is licensed under the MIT License. See LICENSE file for details.

## Changelog

### Version 1.0.0

- Initial release
- Google Drive integration
- Mega.nz integration
- Web UI for file management
- OAuth2 authentication
- Secure credential storage

---

The Cloud Storage plugin brings powerful cloud file management capabilities to your Raspberry Pi dashboard, enabling seamless integration with popular cloud storage services while maintaining security and performance.
