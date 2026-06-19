const fs = require('fs');
const path = require('path');

const dirs = [
    './src/dashboard',
    './src/fake-dashboard-demo'
];

function walk(dir, callback) {
    fs.readdirSync(dir).forEach(f => {
        let dirPath = path.join(dir, f);
        let isDirectory = fs.statSync(dirPath).isDirectory();
        isDirectory ? walk(dirPath, callback) : callback(path.join(dir, f));
    });
}

function processFiles() {
    let count = 0;
    dirs.forEach(dir => {
        walk(dir, function (filePath) {
            if (filePath.endsWith('.jsx') || filePath.endsWith('.tsx')) {
                let content = fs.readFileSync(filePath, 'utf8');
                let original = content;

                // Replace backgrounds
                content = content.replace(/bg-white\//g, 'bg-dash-cream/');
                content = content.replace(/bg-black\//g, 'bg-dash-base/');
                content = content.replace(/bg-gray-50/g, 'bg-dash-surface');
                content = content.replace(/bg-gray-800/g, 'bg-dash-surface');

                // Replace borders
                content = content.replace(/border-white\//g, 'border-dash-cream/');
                content = content.replace(/border-gray-200/g, 'border-dash-border');
                content = content.replace(/border-gray-700/g, 'border-dash-border');

                // Replace text colors
                content = content.replace(/text-white/g, 'text-dash-cream');
                content = content.replace(/text-gray-900/g, 'text-dash-cream');
                content = content.replace(/text-gray-800/g, 'text-dash-cream');
                content = content.replace(/text-gray-700/g, 'text-dash-secondary');
                content = content.replace(/text-gray-500/g, 'text-dash-tertiary');
                content = content.replace(/text-gray-400/g, 'text-dash-tertiary');
                content = content.replace(/text-gray-300/g, 'text-dash-secondary');

                // Edge cases with opacity that Tailwind doesn't support directly on named colors natively IF they weren't defined with rgb/alpha.
                // But we DID define them with rgb(var() / <alpha-value>) so `bg-dash-cream/10` WILL work!

                if (content !== original) {
                    fs.writeFileSync(filePath, content, 'utf8');
                    count++;
                    console.log('Updated', filePath);
                }
            }
        });
    });
    console.log('Total files updated:', count);
}

processFiles();
