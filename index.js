const express = require('express');
const fileUpload = require('express-fileupload');
const axios = require('axios');
const mime = require('mime-types');
const path = require('path');
const crypto = require('crypto');

const app = express();
const port = process.env.PORT || 3000;

const githubToken = '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';
const owner = 'Uploader195';
const repo = 'aplod';
const branch = 'main';

app.use(fileUpload());
app.use(express.static('public'));

app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'index.html'));
});

app.get('/:code', async (req, res) => {
    const code = req.params.code;

    try {
        const response = await axios.get(
            `https://api.github.com/repos/${owner}/${repo}/contents/uploads`,
            {
                headers: {
                    Authorization: `Bearer ${githubToken}`,
                    'Content-Type': 'application/json',
                },
            }
        );

        const files = response.data;
        const matchedFile = files.find(file => file.name.startsWith(code));

        if (!matchedFile) return res.status(404).send('URL tidak ditemukan');

        const githubUrl = matchedFile.download_url;
        const contentType = mime.lookup(matchedFile.name) || 'application/octet-stream';

        const imageResponse = await axios.get(githubUrl, {
            responseType: 'stream',
            headers: {
                'Cache-Control': 'public, max-age=31536000'
            }
        });

        res.setHeader('Content-Type', contentType);
        imageResponse.data.pipe(res);
    } catch (err) {
        console.error(err.message);
        res.status(500).send('Gagal memuat gambar');
    }
});

app.post('/upload', async (req, res) => {
    if (!req.files || Object.keys(req.files).length === 0) {
        return res.status(400).json({ error: 'No files were uploaded.' });
    }

    const uploadedFile = req.files.file;
    const code = crypto.randomBytes(3).toString('hex');
    const safeName = uploadedFile.name.replace(/\s+/g, '-');
    const fileName = `${code}-${Date.now()}-${safeName}`;
    const filePath = `uploads/${fileName}`;
    const base64Content = Buffer.from(uploadedFile.data).toString('base64');

    try {
        await axios.put(
            `https://api.github.com/repos/${owner}/${repo}/contents/${filePath}`,
            {
                message: `Upload file ${fileName}`,
                content: base64Content,
                branch: branch,
            },
            {
                headers: {
                    Authorization: `Bearer ${githubToken}`,
                    'Content-Type': 'application/json',
                },
            }
        );

        const protocol = req.protocol;
        const host = req.get('host');
        const baseUrl = `${protocol}://${host}`;
        const displayUrl = `${baseUrl}/${code}`;

        res.json({ 
            success: true,
            url: displayUrl,
            filename: uploadedFile.name
        });
    } catch (error) {
        console.error('Upload error:', error.response?.data || error.message);
        res.status(500).json({ 
            error: 'Error uploading file.',
            details: error.response?.data || error.message
        });
    }
});

app.listen(port, () => {
    console.log(`Server running at http://localhost:${port}`);
});
