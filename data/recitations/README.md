# Recitation timing data

The Muhammad Ayyub and Abdul Rashid Sufi verse boundaries and catalog metadata are from Quranic Universal Audio release v2.3.0:

- https://github.com/Wider-Community/quranic-universal-audio/releases/tag/v2.3.0
- `mohammed_ayyub_drive.zip`
- `abdur_rashid_sufi_qdc.zip`

The timing, segmentation, catalog metadata, and project code are licensed under CC BY 4.0. Attribution: Wider Community, Quranic Universal Audio contributors. The uncompressed `*-verse-timestamps.json` files are deployment-ready copies of the corresponding `.json.gz` source files; static imports ensure serverless builds include the timing data.

Recitation recordings remain the property of their reciters and original upstream sources. Abdul Rashid Sufi audio is streamed from the QuranicAudio URLs in the catalog. Muhammad Ayyub uses QuranicAudio's stable per-chapter files (`muhammad_ayyoob`) instead of the catalog's multi-chapter Google Drive files; its imported verse boundaries are therefore treated as approximate. Audio is not redistributed here.

## Hadr recitations

The Hadr catalogs were generated from Internet Archive item metadata on 2026-08-06:

- Ahmed Deban, 114 chapter files: https://archive.org/details/Z02_20190528
- Yasser Salama, 604 Madani Mushaf page files: https://archive.org/details/396_20220322zzzzz

The local catalogs contain only file names, durations, sizes, and source identifiers. Audio is streamed from Internet Archive. Neither item exposes verse timing data, so Ahmed Deban is synchronized at chapter level and Yasser Salama at page level. The raw item metadata did not include a `licenseurl` or a clear redistribution grant when verified; confirm usage rights with the recording owners before commercial publication.
