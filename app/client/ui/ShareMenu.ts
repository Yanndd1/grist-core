import {loadUserManager} from 'app/client/lib/imports';
import {AppModel, reportError} from 'app/client/models/AppModel';
import {DocInfo, DocPageModel} from 'app/client/models/DocPageModel';
import {urlState} from 'app/client/models/gristUrlState';
import {makeCopy, replaceTrunkWithFork} from 'app/client/ui/MakeCopyMenu';
import {cssHoverCircle, cssTopBarBtn} from 'app/client/ui/TopBarCss';
import {primaryButton} from 'app/client/ui2018/buttons';
import {colors, testId} from 'app/client/ui2018/cssVars';
import {icon} from 'app/client/ui2018/icons';
import {menu, menuDivider, menuIcon, menuItem, menuItemLink, menuText} from 'app/client/ui2018/menus';
import {buildUrlId, parseUrlId} from 'app/common/gristUrls';
import * as roles from 'app/common/roles';
import {Document} from 'app/common/UserAPI';
import {dom, DomContents, styled} from 'grainjs';
import {MenuCreateFunc} from 'popweasel';

function buildOriginalUrlId(urlId: string, isSnapshot: boolean): string {
  const parts = parseUrlId(urlId);
  return isSnapshot ? buildUrlId({...parts, snapshotId: undefined}) : parts.trunkId;
}

/**
 * Builds the content of the export menu. The menu button and contents render differently for
 * different modes (normal, pre-fork, fork, snapshot).
 */
export function buildShareMenuButton(pageModel: DocPageModel): DomContents {
  // The menu needs pageModel.currentDoc to render the button. It further needs pageModel.gristDoc
  // to render its contents, but we handle by merely skipping such content if gristDoc is not yet
  // available (a user quick enough to open the menu in this state would have to re-open it).
  return dom.maybe(pageModel.currentDoc, (doc) => {
    const appModel = pageModel.appModel;
    const saveCopy = () => makeCopy(doc, appModel, 'Save Document').catch(reportError);
    if (doc.idParts.snapshotId) {
      const backToCurrent = () => urlState().pushUrl({doc: buildOriginalUrlId(doc.id, true)});
      return shareButton('Back to Current', () => [
        menuManageUsers(doc, pageModel),
        menuSaveCopy('Save Copy', doc, appModel),
        menuOriginal(doc, appModel, true),
        menuExports(doc, pageModel),
      ], {buttonAction: backToCurrent});
    } else if (doc.isPreFork || doc.isBareFork) {
      // A new unsaved document, or a fiddle, or a public example.
      const saveActionTitle = doc.isBareFork ? 'Save Document' : 'Save Copy';
      return shareButton(saveActionTitle, () => [
        menuManageUsers(doc, pageModel),
        menuSaveCopy(saveActionTitle, doc, appModel),
        menuExports(doc, pageModel),
      ], {buttonAction: saveCopy});
    } else if (doc.isFork) {
      // For forks, the main actions are "Replace Original" and "Save Copy". When "Replace
      // Original" is unavailable (for samples, forks of public docs, etc), we'll consider "Save
      // Copy" primary and keep it as an action button on top. Otherwise, show a tag without a
      // default action; click opens the menu where the user can choose.
      if (!roles.canEdit(doc.trunkAccess || null)) {
        return shareButton('Save Copy', () => [
          menuManageUsers(doc, pageModel),
          menuSaveCopy('Save Copy', doc, appModel),
          menuOriginal(doc, appModel, false),
          menuExports(doc, pageModel),
        ], {buttonAction: saveCopy});
      } else {
        return shareButton('Unsaved', () => [
          menuManageUsers(doc, pageModel),
          menuSaveCopy('Save Copy', doc, appModel),
          menuOriginal(doc, appModel, false),
          menuExports(doc, pageModel),
        ]);
      }
    } else {
      return shareButton(null, () => [
        menuManageUsers(doc, pageModel),
        menuSaveCopy('Duplicate Document', doc, appModel),
        menuWorkOnCopy(pageModel),
        menuExports(doc, pageModel),
      ]);
    }
  });
}

/**
 * Render the share button, possibly as a text+icon pair when buttonText is not null. The text
 * portion can be an independent action button (when buttonAction is given), or simply a more
 * visible extension of the icon that opens the menu.
 */
function shareButton(buttonText: string|null, menuCreateFunc: MenuCreateFunc,
                     options: {buttonAction?: () => void} = {},
) {
  if (!buttonText) {
    // Regular circular button that opens a menu.
    return cssHoverCircle({ style: `margin: 5px;` },
      cssTopBarBtn('Share'),
      menu(menuCreateFunc, {placement: 'bottom-end'}),
      testId('tb-share'),
    );
  } else if (options.buttonAction) {
    // Split button: the left text part calls `buttonAction`, and the circular icon opens menu.
    return cssShareButton(
      cssShareAction(buttonText,
        dom.on('click', options.buttonAction),
        testId('tb-share-action'),
      ),
      cssShareCircle(
        cssShareIcon('Share'),
        menu(menuCreateFunc, {placement: 'bottom-end'}),
        testId('tb-share'),
      ),
    );
  } else {
    // Combined button: the left text part and circular icon open the menu as a single button.
    return cssShareButton(
      cssShareButton.cls('-combined'),
      cssShareAction(buttonText),
      cssShareCircle(
        cssShareIcon('Share')
      ),
      menu(menuCreateFunc, {placement: 'bottom-end'}),
      testId('tb-share'),
    );
  }
}

// Renders "Manage Users" menu item.
function menuManageUsers(doc: DocInfo, pageModel: DocPageModel) {
  return [
    menuItem(() => manageUsers(doc, pageModel), 'Manage Users',
      dom.cls('disabled', !roles.canEditAccess(doc.access)),
      testId('tb-share-option')
    ),
    menuDivider(),
  ];
}

// Renders "Return to Original" and "Replace Original" menu items. When used with snapshots, we
// say "Current Version" in place of the word "Original".
function menuOriginal(doc: Document, appModel: AppModel, isSnapshot: boolean) {
  const termToUse = isSnapshot ? "Current Version" : "Original";
  const origUrlId = buildOriginalUrlId(doc.id, isSnapshot);
  const originalUrl = urlState().makeUrl({doc: origUrlId});
  function replaceOriginal() {
    const user = appModel.currentValidUser;
    replaceTrunkWithFork(user, doc, appModel, origUrlId).catch(reportError);
  }
  return [
    cssMenuSplitLink({href: originalUrl},
      cssMenuSplitLinkText(`Return to ${termToUse}`), testId('return-to-original'),
      cssMenuIconLink({href: originalUrl, target: '_blank'}, testId('open-original'),
        cssMenuIcon('FieldLink'),
      )
    ),
    menuItem(replaceOriginal, `Replace ${termToUse}...`,
      dom.cls('disabled', !roles.canEdit(doc.trunkAccess || null)),
      testId('replace-original'),
    ),
  ];
}

// Renders "Save Copy..." and "Copy as Template..." menu items. The name of the first action is
// specified in saveActionTitle.
function menuSaveCopy(saveActionTitle: string, doc: Document, appModel: AppModel) {
  const saveCopy = () => makeCopy(doc, appModel, saveActionTitle).catch(reportError);
  return [
    // TODO Disable these when user has no accessible destinations.
    menuItem(saveCopy, `${saveActionTitle}...`, testId('save-copy')),
  ];
}

// Renders "Work on a Copy" menu item.
function menuWorkOnCopy(pageModel: DocPageModel) {
  const gristDoc = pageModel.gristDoc.get();
  if (!gristDoc) { return null; }

  const makeUnsavedCopy = async function() {
    const {urlId} = await gristDoc.docComm.fork();
    await urlState().pushUrl({doc: urlId});
  };

  return [
    menuItem(makeUnsavedCopy, 'Work on a Copy', testId('work-on-copy')),
    menuText('Edit without affecting the original'),
  ];
}

/**
 * The part of the menu with "Download" and "Export CSV" items.
 */
function menuExports(doc: Document, pageModel: DocPageModel) {
  const isElectron = (window as any).isRunningUnderElectron;
  const gristDoc = pageModel.gristDoc.get();
  if (!gristDoc) { return null; }

  // Note: This line adds the 'show in folder' option for electron and a download option for hosted.
  return [
    menuDivider(),
    (isElectron ?
      menuItem(() => gristDoc.app.comm.showItemInFolder(doc.name),
        'Show in folder', testId('tb-share-option')) :
      menuItemLink({ href: gristDoc.getDownloadLink(), target: '_blank', download: ''},
        menuIcon('Download'), 'Download', testId('tb-share-option'))
    ),
    menuItemLink({ href: gristDoc.getCsvLink(), target: '_blank', download: ''},
      menuIcon('Download'), 'Export CSV', testId('tb-share-option')),
  ];
}

/**
 * Opens the user-manager for the doc.
 */
async function manageUsers(doc: DocInfo, docPageModel: DocPageModel) {
  const appModel: AppModel = docPageModel.appModel;
  const api = appModel.api;
  const user = appModel.currentValidUser;
  (await loadUserManager()).showUserManagerModal(api, {
    permissionData: api.getDocAccess(doc.id),
    activeEmail: user ? user.email : null,
    resourceType: 'document',
    resourceId: doc.id,
    docPageModel,
    // On save, re-fetch the document info, to toggle the "Public Access" icon if it changed.
    onSave: () => docPageModel.refreshCurrentDoc(doc),
  });
}

const cssShareButton = styled('div', `
  display: flex;
  align-items: center;
  position: relative;
  z-index: 0;
  margin: 5px;
  white-space: nowrap;

  --share-btn-bg: ${colors.lightGreen};
  &-combined:hover, &-combined.weasel-popup-open {
    --share-btn-bg: ${colors.darkGreen};
  }
`);

const cssShareAction = styled(primaryButton, `
  margin-right: -16px;
  padding-right: 24px;
  background-color: var(--share-btn-bg);
  border-color:     var(--share-btn-bg);
`);

const cssShareCircle = styled(cssHoverCircle, `
  z-index: 1;
  background-color: var(--share-btn-bg);
  border: 1px solid white;
  &:hover, &.weasel-popup-open {
    background-color: ${colors.darkGreen};
  }
`);

const cssShareIcon = styled(cssTopBarBtn, `
  background-color: white;
  height: 30px;
  width: 30px;
`);

const cssMenuSplitLink = styled(menuItemLink, `
  padding: 0;
  align-items: stretch;
`);

const cssMenuSplitLinkText = styled('div', `
  flex: auto;
  padding: var(--weaseljs-menu-item-padding, 8px 24px);
  &:not(:hover) {
    background-color: white;
    color: black;
  }
`);

const cssMenuIconLink = styled('a', `
  display: block;
  flex: none;
  padding: 8px 24px;

  background-color: white;
  --icon-color: ${colors.lightGreen};
  &:hover {
    background-color: ${colors.mediumGreyOpaque};
    --icon-color: ${colors.darkGreen};
  }
`);

const cssMenuIcon = styled(icon, `
  display: block;
`);
