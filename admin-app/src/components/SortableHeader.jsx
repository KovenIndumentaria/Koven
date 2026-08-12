import sortIcon from "../../../assets/icons/sort.svg";
import sortAscIcon from "../../../assets/icons/sort-asc.svg";
import sortDescIcon from "../../../assets/icons/sort-desc.svg";

export default function SortableHeader({ column, label, sort, onSort }) {
  const active = sort.column === column;
  const direction = active ? sort.direction : null;
  const icon = direction === "asc" ? sortAscIcon : direction === "desc" ? sortDescIcon : sortIcon;
  return <th aria-sort={!active ? "none" : direction === "asc" ? "ascending" : "descending"}>
    <button className={`sort-button${active ? " active" : ""}`} type="button" onClick={() => onSort(column)}>
      <span>{label}</span><img src={icon} alt="" aria-hidden="true" />
    </button>
  </th>;
}
