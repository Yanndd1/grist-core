/**
 * NewBaseEditor is equivalent to BaseEditor for outside code, but is in typescript, and
 * so is friendlier and clearer to derive TypeScript classes from.
 */
import {GristDoc} from 'app/client/components/GristDoc';
import {ViewFieldRec} from 'app/client/models/entities/ViewFieldRec';
import {CellValue} from "app/common/DocActions";
import {Disposable, IDisposableOwner, Observable} from 'grainjs';

export interface Options {
  gristDoc: GristDoc;
  field: ViewFieldRec;
  cellValue: CellValue;
  formulaError?: Observable<CellValue>;
  editValue?: string;
  cursorPos: number;
  commands: {[cmd: string]: () => void};
}

/**
 * Required parameters:
 * @param {RowModel} options.field: ViewSectionField (i.e. column) being edited.
 * @param {String} options.cellValue: The value in the underlying cell being edited.
 * @param {String} options.editValue: String to be edited, or undefined to use cellValue.
 * @param {Number} options.cursorPos: The initial position where to place the cursor.
 * @param {Element} option.cellRect: Bounding box of the element representing the cell that this
 *  editor should match in size and position.
 * @param {Object} options.commands: Object mapping command names to functions, to enable as part
 *  of the command group that should be activated while the editor exists.
 */
export abstract class NewBaseEditor extends Disposable {
  /**
   * Override the create() method to allow the parameters of create() expected by old-style
   * Editors and provided by FieldBuilder. TODO: remove this method once all editors have been
   * updated to new-style Disposables.
   */
  public static create(owner: IDisposableOwner|null, options: Options): NewBaseEditor;
  public static create(options: Options): NewBaseEditor;
  public static create(ownerOrOptions: any, options?: any): NewBaseEditor {
    return options ?
      Disposable.create.call(this as any, ownerOrOptions, options) :
      Disposable.create.call(this as any, null, ownerOrOptions);
  }

  /**
   * Check if the typed-in value should change the cell without opening the editor, and if so,
   * returns the value to save. E.g. on typing " ", CheckBoxEditor toggles value without opening.
   */
  public static skipEditor(typedVal: string|undefined, origVal: CellValue): CellValue|undefined {
    return undefined;
  }

  constructor(protected options: Options) {
    super();
  }

  /**
   * Called after the editor is instantiated to attach its DOM to the page.
   * - cellRect: Bounding box of the element representing the cell that this editor should match
   *   in size and position. Used by derived classes, e.g. to construct an EditorPlacement object.
   */
  public abstract attach(cellRect: ClientRect|DOMRect): void;

  /**
   * Called to get the value to save back to the cell.
   */
  public abstract getCellValue(): CellValue;

  /**
   * Used if an editor needs preform any actions before a save
   */
  public prepForSave(): void | Promise<void> {
    // No-op by default.
  }

  /**
   * Called to get the text in the editor, used when switching between editing data and formula.
   */
  public abstract getTextValue(): string;

  /**
   * Called to get the position of the cursor in the editor. Used when switching between editing
   * data and formula.
   */
  public abstract getCursorPos(): number;
}
