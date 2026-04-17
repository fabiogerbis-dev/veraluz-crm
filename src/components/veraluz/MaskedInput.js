import { forwardRef } from "react";
import PropTypes from "prop-types";
import { IMaskInput } from "react-imask";
import MDInput from "components/MDInput";

const MaskedInputInner = forwardRef(function MaskedInputInner(props, ref) {
  const { onAccept, onChange, mask, ...other } = props;

  const handleAccept = (value) => {
    if (typeof onAccept === "function") {
      onAccept(value);
    }

    if (typeof onChange === "function") {
      onChange({ target: { name: props.name, value } });
    }
  };

  return <IMaskInput {...other} mask={mask} inputRef={ref} onAccept={handleAccept} overwrite />;
});

MaskedInputInner.propTypes = {
  name: PropTypes.string,
  onAccept: PropTypes.func,
  onChange: PropTypes.func,
  mask: PropTypes.string.isRequired,
};

const MASKS = {
  phone: "(00) 00000-0000",
  cpf: "000.000.000-00",
  cnpj: "00.000.000/0000-00",
};

function MaskedInput({ InputProps, mask, maskType, onAccept, onChange, ...rest }) {
  const resolvedMask = MASKS[maskType || mask];

  if (!resolvedMask) {
    return <MDInput {...rest} onChange={onChange} InputProps={InputProps} />;
  }

  return (
    <MDInput
      {...rest}
      onChange={onChange}
      InputProps={{
        ...InputProps,
        inputComponent: MaskedInputInner,
        inputProps: {
          ...(InputProps?.inputProps || {}),
          mask: resolvedMask,
          onAccept,
        },
      }}
    />
  );
}

MaskedInput.propTypes = {
  InputProps: PropTypes.object,
  mask: PropTypes.oneOf(["phone", "cpf", "cnpj"]),
  maskType: PropTypes.oneOf(["phone", "cpf", "cnpj"]),
  onAccept: PropTypes.func,
  onChange: PropTypes.func,
};

export default MaskedInput;
