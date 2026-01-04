# RadioBrowser
RadioBrowser for Moode
Search and play internet radio stations from radio-browser.info
# Radio Browser Favorites Fix

This archive contains the fixed files for the Radio Browser extension in MoodeAudio to properly persist favorites.
te
## Files Included

- `var/www/extensions/installed/radio-browser/backend/api.php` - Added favorites API endpoint
- `var/www/js/scripts-radio-browser.js` - Updated to load and display favorites
- `var/www/templates/radio-browser.html` - Fixed logo path

## Installation

1. Extract the zip file
2. Copy the files to your MoodeAudio installation, preserving the directory structure
3. Restart the web interface or clear browser cache

## Testing

Test on a fresh MoodeAudio installation to verify:
1. Radio Browser extension loads
2. Search and play stations work
3. Adding favorites persists across sessions
4. Favorites are visible in Moode's main radio panel
   
<img width="2129" height="1105" alt="image" src="https://github.com/user-attachments/assets/cd29ebda-3824-4445-9d62-42b3de11d70f" />
<img width="2104" height="1141" alt="image" src="https://github.com/user-attachments/assets/f7bb9d88-138b-4b81-a731-32e174248f29" />

<img width="1152" height="981" alt="image" src="https://github.com/user-attachments/assets/6c496c76-2266-40c8-bf8c-01ca1346e7ad" />
<img width="1456" height="658" alt="image" src="https://github.com/user-attachments/assets/0166f68f-108b-43a0-8ced-ae192e389767" />


